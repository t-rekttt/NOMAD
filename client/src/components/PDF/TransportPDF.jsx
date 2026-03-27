// Transport instruction PDF via browser print window
import { calculateSegmentsWithSteps, generateLegUrl, generateQrDataUrl } from '../Map/RouteCalculator'

function escHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shortDate(d, locale) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

function placeLabel(name, address) {
  const n = escHtml(name)
  if (!address || address === name) return n
  return `${n}<br/><span class="place-address">${escHtml(address)}</span>`
}

function buildLegHtml(seg, i, fromName, toName, fromAddress, toAddress, qrDataUrl) {

  const stepsHtml = seg.steps.length > 0
    ? seg.steps.map((s, si) => `
      <tr class="${si % 2 === 0 ? 'row-even' : ''}">
        <td class="step-num">${si + 1}</td>
        <td class="step-action">${escHtml(s.action)}</td>
        <td class="step-street">${escHtml(s.street)}</td>
        <td class="step-dist">${escHtml(s.distance)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="no-steps">Direct route — follow the road</td></tr>'

  return `
    <div class="leg">
      <div class="leg-header">
        <div class="leg-title-row">
          <span class="leg-num">${i + 1}</span>
          <div class="leg-title-text">
            <div class="leg-from-to">${placeLabel(fromName, fromAddress)} <span class="arrow">&#8594;</span> ${placeLabel(toName, toAddress)}</div>
            <div class="leg-stats">
              <span class="stat-pill">${escHtml(seg.distanceText)}</span>
              <span class="stat-pill stat-walk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.5"/><path d="M9 20l3-6 3 6M12 14V9l-2 2"/></svg> ${escHtml(seg.walkingText)}</span>
              <span class="stat-pill stat-drive"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-5l-2-5H7L5 12z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg> ${escHtml(seg.drivingText)}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="leg-body">
        <div class="leg-directions">
          <table class="steps-table">
            <thead>
              <tr><th class="th-num">#</th><th>Action</th><th>Street</th><th class="th-dist">Distance</th></tr>
            </thead>
            <tbody>${stepsHtml}</tbody>
          </table>
        </div>
        <div class="leg-qr">
          <div class="qr-frame">
            <img src="${qrDataUrl}" alt="QR" width="140" height="140" />
          </div>
          <div class="qr-label">Scan to open in<br/><strong>Google Maps</strong></div>
        </div>
      </div>
    </div>`
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Poppins', sans-serif;
    background: #fff; color: #1e293b; font-size: 11px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  svg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 14mm 12mm; }
  .page-break { page-break-before: always; }

  /* ── Cover ──────────────────────────────────── */
  .cover {
    width: 100%; min-height: 220px;
    background: #0f172a;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    padding: 48px 40px; position: relative; overflow: hidden;
    border-radius: 0 0 16px 16px; margin-bottom: 28px;
  }
  .cover-icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  .cover-icon svg { color: rgba(255,255,255,0.7); }
  .cover-label {
    font-size: 8px; font-weight: 600; letter-spacing: 3px;
    color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 8px;
  }
  .cover h1 {
    font-size: 28px; font-weight: 700; color: #fff;
    line-height: 1.15; margin-bottom: 6px; text-align: center;
  }
  .cover .subtitle {
    font-size: 12px; color: rgba(255,255,255,0.5);
    text-align: center; line-height: 1.5;
  }
  .cover-stats {
    display: flex; gap: 28px; margin-top: 20px;
  }
  .cover-stat {
    text-align: center;
  }
  .cover-stat-num { font-size: 22px; font-weight: 700; color: #fff; line-height: 1; }
  .cover-stat-lbl { font-size: 8px; font-weight: 500; color: rgba(255,255,255,0.35); letter-spacing: 1px; margin-top: 3px; text-transform: uppercase; }

  /* ── Day divider ────────────────────────────── */
  .day-divider {
    page-break-before: always;
    background: #0f172a; padding: 12px 24px;
    display: flex; align-items: center; gap: 10px;
    margin: 0 0 16px; border-radius: 8px;
  }
  .day-divider:first-of-type { page-break-before: auto; }
  .day-tag {
    font-size: 8px; font-weight: 700; color: #fff; letter-spacing: 0.8px;
    background: rgba(255,255,255,0.12); border-radius: 4px; padding: 3px 8px;
    text-transform: uppercase; flex-shrink: 0;
  }
  .day-divider h2 { font-size: 13px; font-weight: 600; color: #fff; flex: 1; margin: 0; }
  .day-divider .day-meta { font-size: 9px; color: rgba(255,255,255,0.45); }

  /* ── Leg card ───────────────────────────────── */
  .leg {
    margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 12px;
    overflow: hidden; page-break-inside: avoid; background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .leg-header { background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
  .leg-title-row { display: flex; align-items: flex-start; gap: 10px; }
  .leg-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 50%;
    background: #0f172a; color: #fff; font-size: 12px; font-weight: 700;
    flex-shrink: 0; margin-top: 1px;
  }
  .leg-title-text { flex: 1; min-width: 0; }
  .leg-from-to { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.3; }
  .leg-from-to .arrow { color: #94a3b8; margin: 0 2px; font-weight: 400; }
  .leg-from-to .place-address { font-weight: 400; font-size: 9px; color: #94a3b8; display: block; margin-top: 1px; }
  .leg-stats { display: flex; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
  .stat-pill {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 9px; font-weight: 600; color: #475569;
    background: #e2e8f0; border-radius: 99px; padding: 2px 8px;
  }
  .stat-walk { background: #ecfdf5; color: #059669; }
  .stat-drive { background: #eff6ff; color: #2563eb; }
  .stat-pill svg { flex-shrink: 0; }

  .leg-body { display: flex; gap: 16px; padding: 14px 16px; }
  .leg-directions { flex: 1; min-width: 0; }
  .leg-qr { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }

  .qr-frame {
    padding: 8px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .qr-frame img { display: block; border-radius: 4px; }
  .qr-label {
    font-size: 8px; color: #94a3b8; text-align: center; line-height: 1.3;
  }
  .qr-label strong { color: #475569; }

  /* ── Steps table ────────────────────────────── */
  .steps-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .steps-table th {
    text-align: left; font-weight: 600; font-size: 8px; color: #94a3b8;
    padding: 5px 8px; border-bottom: 2px solid #e2e8f0;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .th-num { width: 24px; }
  .th-dist { width: 55px; text-align: right; }
  .steps-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .row-even td { background: #fafbfc; }
  .step-num { color: #cbd5e1; font-size: 9px; font-weight: 600; }
  .step-action { font-weight: 500; color: #1e293b; }
  .step-street { color: #64748b; }
  .step-dist { text-align: right; color: #94a3b8; white-space: nowrap; font-weight: 500; }
  .no-steps { text-align: center; color: #94a3b8; padding: 14px; font-style: italic; }

  /* ── Footer ─────────────────────────────────── */
  .pdf-footer {
    position: fixed; bottom: 16px; left: 0; right: 0;
    text-align: center; font-size: 7px; color: #cbd5e1;
    letter-spacing: 0.5px;
  }
`

const ROUTE_ICON_SVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12"/></svg>`

function showPreview(html, title) {
  // Remove any existing preview
  document.getElementById('transport-pdf-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'transport-pdf-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:8px;'
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }

  const card = document.createElement('div')
  card.style.cssText = 'width:100%;max-width:1000px;height:95vh;background:var(--bg-card);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);'

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border-primary);flex-shrink:0;'
  header.innerHTML = `
    <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${escHtml(title)}</span>
    <div style="display:flex;align-items:center;gap:8px">
      <button id="transport-pdf-save-btn" style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;color:var(--accent-text);background:var(--accent);border:none;cursor:pointer;padding:5px 12px;border-radius:6px;font-family:inherit">Save as PDF</button>
      <button id="transport-pdf-close-btn" style="background:none;border:none;cursor:pointer;color:var(--text-faint);display:flex;padding:4px;border-radius:6px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'flex:1;width:100%;border:none;'
  iframe.sandbox = 'allow-same-origin allow-modals'
  iframe.srcdoc = html

  card.appendChild(header)
  card.appendChild(iframe)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  header.querySelector('#transport-pdf-close-btn').onclick = () => overlay.remove()
  header.querySelector('#transport-pdf-save-btn').onclick = () => { iframe.contentWindow?.print() }
}

function wrapPage(loc, title, coverHtml, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="${loc}">
<head>
<meta charset="UTF-8">
<title>Transportation Instructions — ${escHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
  ${coverHtml}
  ${bodyHtml}
  <div class="pdf-footer">Generated by NOMAD</div>
</body>
</html>`
}

// Single-day transport PDF
export async function downloadTransportPDF({ day, waypoints, t: _t, locale: _locale }) {
  const loc = _locale || 'en'
  const tr = _t || (k => k)
  if (!waypoints || waypoints.length < 2) return

  let segments
  try {
    segments = await calculateSegmentsWithSteps(waypoints)
  } catch {
    alert('Could not calculate navigation. Please try again.')
    return
  }

  const dayLabel = tr('dayplan.dayN', { n: day.day_number })
  const dateStr = day.date ? shortDate(day.date, loc) : ''
  const title = day.title || dayLabel
  const totalDist = segments.reduce((s, seg) => s + seg.distance, 0)
  const totalDistText = totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : `${Math.round(totalDist)} m`

  // Pre-generate all QR codes locally (no network)
  const qrDataUrls = await Promise.all(
    segments.map(seg => generateQrDataUrl(generateLegUrl(seg.from, seg.to), 140))
  )

  const legsHtml = segments.map((seg, i) => {
    const fromWp = waypoints[i]
    const toWp = waypoints[i + 1]
    return buildLegHtml(seg, i, fromWp.name || `Stop ${i + 1}`, toWp.name || `Stop ${i + 2}`, fromWp.address, toWp.address, qrDataUrls[i])
  }).join('')

  const coverHtml = `
    <div class="cover">
      <div class="cover-icon">${ROUTE_ICON_SVG}</div>
      <div class="cover-label">Transportation Instructions</div>
      <h1>${escHtml(title)}</h1>
      <div class="subtitle">${escHtml(dayLabel)}${dateStr ? ' — ' + escHtml(dateStr) : ''}</div>
      <div class="cover-stats">
        <div class="cover-stat"><div class="cover-stat-num">${segments.length}</div><div class="cover-stat-lbl">${segments.length === 1 ? 'Leg' : 'Legs'}</div></div>
        <div class="cover-stat"><div class="cover-stat-num">${waypoints.length}</div><div class="cover-stat-lbl">Stops</div></div>
        <div class="cover-stat"><div class="cover-stat-num">${escHtml(totalDistText)}</div><div class="cover-stat-lbl">Total</div></div>
      </div>
    </div>`

  showPreview(wrapPage(loc, title, coverHtml, legsHtml), `Transportation Instructions — ${title}`)
}

// Whole-trip transport PDF
export async function downloadTripTransportPDF({ trip, days, assignments, t: _t, locale: _locale }) {
  const loc = _locale || 'en'
  const tr = _t || (k => k)
  const sorted = [...(days || [])].sort((a, b) => a.day_number - b.day_number)

  const sections = []
  let totalLegs = 0
  let totalStops = 0
  let totalDistance = 0

  for (const day of sorted) {
    const assigned = assignments[String(day.id)] || []
    const waypoints = assigned.map(a => a.place).filter(p => p?.lat && p?.lng)
    if (waypoints.length < 2) continue

    let segments
    try {
      segments = await calculateSegmentsWithSteps(waypoints)
    } catch {
      continue
    }

    totalLegs += segments.length
    totalStops += waypoints.length
    totalDistance += segments.reduce((s, seg) => s + seg.distance, 0)

    const dayLabel = tr('dayplan.dayN', { n: day.day_number })
    const dateStr = day.date ? shortDate(day.date, loc) : ''
    const title = day.title || dayLabel

    const qrDataUrls = await Promise.all(
      segments.map(seg => generateQrDataUrl(generateLegUrl(seg.from, seg.to), 140))
    )

    const legsHtml = segments.map((seg, i) => {
      const fromWp = waypoints[i]
      const toWp = waypoints[i + 1]
      return buildLegHtml(seg, i, fromWp.name || `Stop ${i + 1}`, toWp.name || `Stop ${i + 2}`, fromWp.address, toWp.address, qrDataUrls[i])
    }).join('')

    sections.push(`
      <div class="day-divider">
        <span class="day-tag">${escHtml(dayLabel)}</span>
        <h2>${escHtml(title)}</h2>
        ${dateStr ? `<span class="day-meta">${escHtml(dateStr)}</span>` : ''}
      </div>
      ${legsHtml}`)
  }

  if (sections.length === 0) {
    alert('No days with 2+ places found for transport guide.')
    return
  }

  const tripTitle = trip?.title || 'Trip'
  const totalDistText = totalDistance >= 1000 ? `${(totalDistance / 1000).toFixed(1)} km` : `${Math.round(totalDistance)} m`

  const coverHtml = `
    <div class="cover">
      <div class="cover-icon">${ROUTE_ICON_SVG}</div>
      <div class="cover-label">Transportation Instructions</div>
      <h1>${escHtml(tripTitle)}</h1>
      <div class="subtitle">${sections.length} ${sections.length === 1 ? 'day' : 'days'} with navigation</div>
      <div class="cover-stats">
        <div class="cover-stat"><div class="cover-stat-num">${totalLegs}</div><div class="cover-stat-lbl">Legs</div></div>
        <div class="cover-stat"><div class="cover-stat-num">${totalStops}</div><div class="cover-stat-lbl">Stops</div></div>
        <div class="cover-stat"><div class="cover-stat-num">${escHtml(totalDistText)}</div><div class="cover-stat-lbl">Total</div></div>
      </div>
    </div>`

  showPreview(wrapPage(loc, tripTitle, coverHtml, sections.join('')), `Transportation Instructions — ${tripTitle}`)
}
