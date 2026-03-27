const express = require('express');
const { db, canAccessTrip } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { broadcast } = require('../websocket');

const router = express.Router({ mergeParams: true });

function verifyTripOwnership(tripId, userId) {
  return canAccessTrip(tripId, userId);
}

// GET /api/trips/:tripId/reservations
router.get('/', authenticate, (req, res) => {
  const { tripId } = req.params;

  const trip = verifyTripOwnership(tripId, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const reservations = db.prepare(`
    SELECT r.*, d.day_number, p.name as place_name, r.assignment_id
    FROM reservations r
    LEFT JOIN days d ON r.day_id = d.id
    LEFT JOIN places p ON r.place_id = p.id
    WHERE r.trip_id = ?
    ORDER BY r.reservation_time ASC, r.created_at ASC
  `).all(tripId);

  res.json({ reservations });
});

// POST /api/trips/:tripId/reservations
router.post('/', authenticate, (req, res) => {
  const { tripId } = req.params;
  const { title, reservation_time, reservation_end_time, location, confirmation_number, notes, day_id, place_id, assignment_id, status, type, departure_name, departure_lat, departure_lng, destination_name, destination_lat, destination_lng } = req.body;

  const trip = verifyTripOwnership(tripId, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = db.prepare(`
    INSERT INTO reservations (trip_id, day_id, place_id, assignment_id, title, reservation_time, reservation_end_time, location, confirmation_number, notes, status, type, departure_name, departure_lat, departure_lng, destination_name, destination_lat, destination_lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripId,
    day_id || null,
    place_id || null,
    assignment_id || null,
    title,
    reservation_time || null,
    reservation_end_time || null,
    location || null,
    confirmation_number || null,
    notes || null,
    status || 'pending',
    type || 'other',
    departure_name || null,
    departure_lat != null ? departure_lat : null,
    departure_lng != null ? departure_lng : null,
    destination_name || null,
    destination_lat != null ? destination_lat : null,
    destination_lng != null ? destination_lng : null
  );

  const reservation = db.prepare(`
    SELECT r.*, d.day_number, p.name as place_name, r.assignment_id
    FROM reservations r
    LEFT JOIN days d ON r.day_id = d.id
    LEFT JOIN places p ON r.place_id = p.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ reservation });
  broadcast(tripId, 'reservation:created', { reservation }, req.headers['x-socket-id']);
});

// PUT /api/trips/:tripId/reservations/:id
router.put('/:id', authenticate, (req, res) => {
  const { tripId, id } = req.params;
  const { title, reservation_time, reservation_end_time, location, confirmation_number, notes, day_id, place_id, assignment_id, status, type, departure_name, departure_lat, departure_lng, destination_name, destination_lat, destination_lng } = req.body;

  const trip = verifyTripOwnership(tripId, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND trip_id = ?').get(id, tripId);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  db.prepare(`
    UPDATE reservations SET
      title = COALESCE(?, title),
      reservation_time = ?,
      reservation_end_time = ?,
      location = ?,
      confirmation_number = ?,
      notes = ?,
      day_id = ?,
      place_id = ?,
      assignment_id = ?,
      status = COALESCE(?, status),
      type = COALESCE(?, type),
      departure_name = ?,
      departure_lat = ?,
      departure_lng = ?,
      destination_name = ?,
      destination_lat = ?,
      destination_lng = ?
    WHERE id = ?
  `).run(
    title || null,
    reservation_time !== undefined ? (reservation_time || null) : reservation.reservation_time,
    reservation_end_time !== undefined ? (reservation_end_time || null) : reservation.reservation_end_time,
    location !== undefined ? (location || null) : reservation.location,
    confirmation_number !== undefined ? (confirmation_number || null) : reservation.confirmation_number,
    notes !== undefined ? (notes || null) : reservation.notes,
    day_id !== undefined ? (day_id || null) : reservation.day_id,
    place_id !== undefined ? (place_id || null) : reservation.place_id,
    assignment_id !== undefined ? (assignment_id || null) : reservation.assignment_id,
    status || null,
    type || null,
    departure_name !== undefined ? (departure_name || null) : reservation.departure_name,
    departure_lat !== undefined ? (departure_lat != null ? departure_lat : null) : reservation.departure_lat,
    departure_lng !== undefined ? (departure_lng != null ? departure_lng : null) : reservation.departure_lng,
    destination_name !== undefined ? (destination_name || null) : reservation.destination_name,
    destination_lat !== undefined ? (destination_lat != null ? destination_lat : null) : reservation.destination_lat,
    destination_lng !== undefined ? (destination_lng != null ? destination_lng : null) : reservation.destination_lng,
    id
  );

  const updated = db.prepare(`
    SELECT r.*, d.day_number, p.name as place_name, r.assignment_id
    FROM reservations r
    LEFT JOIN days d ON r.day_id = d.id
    LEFT JOIN places p ON r.place_id = p.id
    WHERE r.id = ?
  `).get(id);

  res.json({ reservation: updated });
  broadcast(tripId, 'reservation:updated', { reservation: updated }, req.headers['x-socket-id']);
});

// DELETE /api/trips/:tripId/reservations/:id
router.delete('/:id', authenticate, (req, res) => {
  const { tripId, id } = req.params;

  const trip = verifyTripOwnership(tripId, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const reservation = db.prepare('SELECT id FROM reservations WHERE id = ? AND trip_id = ?').get(id, tripId);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  db.prepare('DELETE FROM reservations WHERE id = ?').run(id);
  res.json({ success: true });
  broadcast(tripId, 'reservation:deleted', { reservationId: Number(id) }, req.headers['x-socket-id']);
});

module.exports = router;
