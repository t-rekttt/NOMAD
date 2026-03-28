const express = require('express');
const fetch = require('node-fetch');
const { db } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { OpenLocationCode } = require('open-location-code');

const router = express.Router();

// Get API key: user's own key, or fall back to any admin's key
function getMapsKey(userId) {
  const user = db.prepare('SELECT maps_api_key FROM users WHERE id = ?').get(userId);
  if (user?.maps_api_key) return user.maps_api_key;
  const admin = db.prepare("SELECT maps_api_key FROM users WHERE role = 'admin' AND maps_api_key IS NOT NULL AND maps_api_key != '' LIMIT 1").get();
  return admin?.maps_api_key || null;
}

// In-memory photo cache: placeId → { photoUrl, attribution, fetchedAt }
const photoCache = new Map();
const PHOTO_TTL = 12 * 60 * 60 * 1000; // 12 hours

// Nominatim search (OpenStreetMap) — free fallback when no Google API key
async function searchNominatim(query, lang) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '10',
    'accept-language': lang || 'en',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'NOMAD Travel Planner (https://github.com/mauriceboe/NOMAD)' },
  });
  if (!response.ok) throw new Error('Nominatim API error');
  const data = await response.json();
  return data.map(item => ({
    google_place_id: null,
    osm_id: `${item.osm_type}/${item.osm_id}`,
    name: item.name || item.display_name?.split(',')[0] || '',
    address: item.display_name || '',
    lat: parseFloat(item.lat) || null,
    lng: parseFloat(item.lon) || null,
    rating: null,
    website: null,
    phone: null,
    source: 'openstreetmap',
  }));
}

// POST /api/maps/search
router.post('/search', authenticate, async (req, res) => {
  const { query } = req.body;

  if (!query) return res.status(400).json({ error: 'Search query is required' });

  const apiKey = getMapsKey(req.user.id);

  // No Google API key → use Nominatim (OpenStreetMap)
  if (!apiKey) {
    try {
      const places = await searchNominatim(query, req.query.lang);
      return res.json({ places, source: 'openstreetmap' });
    } catch (err) {
      console.error('Nominatim search error:', err);
      return res.status(500).json({ error: 'OpenStreetMap search error' });
    }
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.websiteUri,places.nationalPhoneNumber,places.types',
      },
      body: JSON.stringify({ textQuery: query, languageCode: req.query.lang || 'en' }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Google Places API error' });
    }

    const places = (data.places || []).map(p => ({
      google_place_id: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      lat: p.location?.latitude || null,
      lng: p.location?.longitude || null,
      rating: p.rating || null,
      website: p.websiteUri || null,
      phone: p.nationalPhoneNumber || null,
      source: 'google',
    }));

    res.json({ places, source: 'google' });
  } catch (err) {
    console.error('Maps search error:', err);
    res.status(500).json({ error: 'Google Places search error' });
  }
});

// GET /api/maps/details/:placeId
router.get('/details/:placeId', authenticate, async (req, res) => {
  const { placeId } = req.params;

  const apiKey = getMapsKey(req.user.id);
  if (!apiKey) {
    return res.status(400).json({ error: 'Google Maps API key not configured' });
  }

  try {
    const lang = req.query.lang || 'de'
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${lang}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours,googleMapsUri,reviews,editorialSummary',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Google Places API error' });
    }

    const place = {
      google_place_id: data.id,
      name: data.displayName?.text || '',
      address: data.formattedAddress || '',
      lat: data.location?.latitude || null,
      lng: data.location?.longitude || null,
      rating: data.rating || null,
      rating_count: data.userRatingCount || null,
      website: data.websiteUri || null,
      phone: data.nationalPhoneNumber || null,
      opening_hours: data.regularOpeningHours?.weekdayDescriptions || null,
      open_now: data.regularOpeningHours?.openNow ?? null,
      google_maps_url: data.googleMapsUri || null,
      summary: data.editorialSummary?.text || null,
      reviews: (data.reviews || []).slice(0, 5).map(r => ({
        author: r.authorAttribution?.displayName || null,
        rating: r.rating || null,
        text: r.text?.text || null,
        time: r.relativePublishTimeDescription || null,
        photo: r.authorAttribution?.photoUri || null,
      })),
    };

    res.json({ place });
  } catch (err) {
    console.error('Maps details error:', err);
    res.status(500).json({ error: 'Error fetching place details' });
  }
});

// GET /api/maps/place-photo/:placeId
// Proxies a Google Places photo (hides API key from client). Returns { photoUrl, attribution }.
router.get('/place-photo/:placeId', authenticate, async (req, res) => {
  const { placeId } = req.params;

  // Check TTL cache
  const cached = photoCache.get(placeId);
  if (cached && Date.now() - cached.fetchedAt < PHOTO_TTL) {
    return res.json({ photoUrl: cached.photoUrl, attribution: cached.attribution });
  }

  const apiKey = getMapsKey(req.user.id);
  if (!apiKey) {
    return res.status(400).json({ error: 'Google Maps API key not configured' });
  }

  try {
    // Fetch place details to get photo reference
    const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos',
      },
    });
    const details = await detailsRes.json();

    if (!detailsRes.ok) {
      console.error('Google Places photo details error:', details.error?.message || detailsRes.status);
      return res.status(404).json({ error: 'Photo could not be retrieved' });
    }

    if (!details.photos?.length) {
      return res.status(404).json({ error: 'No photo available' });
    }

    const photo = details.photos[0];
    const photoName = photo.name;
    const attribution = photo.authorAttributions?.[0]?.displayName || null;

    // Fetch the media URL (skipHttpRedirect returns JSON with photoUri)
    const mediaRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=600&key=${apiKey}&skipHttpRedirect=true`
    );
    const mediaData = await mediaRes.json();
    const photoUrl = mediaData.photoUri;

    if (!photoUrl) {
      return res.status(404).json({ error: 'Photo URL not available' });
    }

    photoCache.set(placeId, { photoUrl, attribution, fetchedAt: Date.now() });

    // Persist the photo URL to all places with this google_place_id so future
    // loads serve image_url directly without hitting the Google API again.
    try {
      db.prepare(
        'UPDATE places SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE google_place_id = ? AND (image_url IS NULL OR image_url = ?)'
      ).run(photoUrl, placeId, '');
    } catch (dbErr) {
      console.error('Failed to persist photo URL to database:', dbErr);
    }

    res.json({ photoUrl, attribution });
  } catch (err) {
    console.error('Place photo error:', err);
    res.status(500).json({ error: 'Error fetching photo' });
  }
});

// POST /api/maps/parse — extract coordinates from Google Maps URL or Plus Code
const olc = new OpenLocationCode();

function parseGoogleMapsInput(input) {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()

  // Try Plus Code (contains + and alphanumeric, 4-12 chars before +)
  if (/^[2-9CFGHJMPQRVWX]{2,8}\+[2-9CFGHJMPQRVWX]{2,3}$/i.test(trimmed)) {
    try {
      if (olc.isFull(trimmed.toUpperCase())) {
        const decoded = olc.decode(trimmed.toUpperCase())
        return { lat: decoded.latitudeCenter, lng: decoded.longitudeCenter, source: 'plus_code' }
      }
    } catch { /* not a valid plus code */ }
  }

  // Try Google Maps URL patterns
  try {
    // Pattern 1: !3d{lat}!4d{lng} in data param — actual place coordinates (preferred)
    const placeMatch = trimmed.match(/!3d(-?[0-9]+\.?[0-9]*)!4d(-?[0-9]+\.?[0-9]*)/)
    if (placeMatch) {
      const lat = parseFloat(placeMatch[1])
      const lng = parseFloat(placeMatch[2])
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng, source: 'google_maps_url' }
      }
    }

    // Pattern 2: @lat,lng in URL path (viewport center — fallback if !3d/!4d absent)
    const atMatch = trimmed.match(/@(-?[0-9]+\.?[0-9]*),(-?[0-9]+\.?[0-9]*)/)
    if (atMatch) {
      const lat = parseFloat(atMatch[1])
      const lng = parseFloat(atMatch[2])
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng, source: 'google_maps_url' }
      }
    }

    // Pattern 3: query parameters (q, ll, center, query)
    const url = new URL(trimmed)
    for (const param of ['q', 'll', 'center', 'query']) {
      const val = url.searchParams.get(param)
      if (val) {
        const coordMatch = val.match(/^(-?[0-9]+\.?[0-9]*),\s*(-?[0-9]+\.?[0-9]*)$/)
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1])
          const lng = parseFloat(coordMatch[2])
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng, source: 'google_maps_url' }
          }
        }
      }
    }

    // Pattern 4: /dir/ paths with coordinates — extract first pair
    const dirMatch = trimmed.match(/\/dir\/(-?[0-9]+\.?[0-9]*),(-?[0-9]+\.?[0-9]*)/)
    if (dirMatch) {
      const lat = parseFloat(dirMatch[1])
      const lng = parseFloat(dirMatch[2])
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng, source: 'google_maps_url' }
      }
    }
  } catch { /* not a valid URL */ }

  // Pattern 5: raw coordinates "lat, lng"
  const rawCoord = trimmed.match(/^(-?[0-9]+\.?[0-9]*),\s*(-?[0-9]+\.?[0-9]*)$/)
  if (rawCoord) {
    const lat = parseFloat(rawCoord[1])
    const lng = parseFloat(rawCoord[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, source: 'coordinates' }
    }
  }

  return null
}

// Reverse geocode via Nominatim to get a place name for parsed coordinates
async function reverseGeocode(lat, lng, lang) {
  try {
    const params = new URLSearchParams({
      lat: String(lat), lon: String(lng),
      format: 'json', addressdetails: '1', zoom: '18',
      'accept-language': lang || 'en',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'User-Agent': 'NOMAD Travel Planner (https://github.com/mauriceboe/NOMAD)' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      name: data.name || data.address?.tourism || data.address?.amenity || data.address?.road || '',
      address: data.display_name || '',
    }
  } catch { return null }
}

router.post('/parse', authenticate, async (req, res) => {
  const { input, lang } = req.body
  if (!input || typeof input !== 'string') return res.status(400).json({ error: 'Input is required' })
  if (input.length > 2048) return res.status(400).json({ error: 'Input too long' })

  const parsed = parseGoogleMapsInput(input)
  if (!parsed) return res.json({ parsed: false })

  // Extract place name from /place/Name/ in URL path if available
  let urlName = ''
  try {
    const placePathMatch = input.match(/\/place\/([^/@]+)/)
    if (placePathMatch) urlName = decodeURIComponent(placePathMatch[1].replace(/\+/g, ' '))
  } catch { /* ignore decode errors */ }

  // Reverse geocode to get place name and address
  const geo = await reverseGeocode(parsed.lat, parsed.lng, lang)
  res.json({
    parsed: true,
    place: {
      lat: parsed.lat,
      lng: parsed.lng,
      name: urlName || geo?.name || '',
      address: geo?.address || '',
      source: parsed.source,
    },
  })
})

module.exports = router;
