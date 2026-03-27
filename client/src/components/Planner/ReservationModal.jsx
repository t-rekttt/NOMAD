import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Modal from '../shared/Modal'
import CustomSelect from '../shared/CustomSelect'
import { Plane, Hotel, Utensils, Train, Car, Ship, Ticket, FileText, Users, Paperclip, X, ExternalLink, Link2, MapPin, Search } from 'lucide-react'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { CustomDatePicker } from '../shared/CustomDateTimePicker'
import CustomTimePicker from '../shared/CustomTimePicker'
import { mapsApi } from '../../api/client'

const TYPE_OPTIONS = [
  { value: 'flight',     labelKey: 'reservations.type.flight',     Icon: Plane },
  { value: 'hotel',      labelKey: 'reservations.type.hotel',      Icon: Hotel },
  { value: 'restaurant', labelKey: 'reservations.type.restaurant', Icon: Utensils },
  { value: 'train',      labelKey: 'reservations.type.train',      Icon: Train },
  { value: 'car',        labelKey: 'reservations.type.car',        Icon: Car },
  { value: 'cruise',     labelKey: 'reservations.type.cruise',     Icon: Ship },
  { value: 'event',      labelKey: 'reservations.type.event',      Icon: Ticket },
  { value: 'tour',       labelKey: 'reservations.type.tour',       Icon: Users },
  { value: 'other',      labelKey: 'reservations.type.other',      Icon: FileText },
]

function buildAssignmentOptions(days, assignments, t, locale) {
  const options = []
  for (const day of (days || [])) {
    const da = (assignments?.[String(day.id)] || []).slice().sort((a, b) => a.order_index - b.order_index)
    if (da.length === 0) continue
    const dayLabel = day.title || t('dayplan.dayN', { n: day.day_number })
    const dateStr = day.date ? ` · ${formatDate(day.date, locale)}` : ''
    const groupLabel = `${dayLabel}${dateStr}`
    // Group header (non-selectable)
    options.push({ value: `_header_${day.id}`, label: groupLabel, disabled: true, isHeader: true })
    for (let i = 0; i < da.length; i++) {
      const place = da[i].place
      if (!place) continue
      const timeStr = place.place_time ? ` · ${place.place_time}${place.end_time ? ' – ' + place.end_time : ''}` : ''
      options.push({
        value: da[i].id,
        label: `  ${i + 1}. ${place.name}${timeStr}`,
        searchLabel: place.name,
        groupLabel,
        dayDate: day.date || null,
      })
    }
  }
  return options
}

function LocationSearchInput({ label, value, onChange, placeholder, inputStyle, labelStyle }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setQuery(value?.name || '')
  }, [value?.name])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = useCallback((q) => {
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q || q.length < 2) { setResults([]); setIsOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const data = await mapsApi.search(q)
        setResults(data.places || [])
        setIsOpen(true)
      } catch { setResults([]) }
      finally { setIsLoading(false) }
    }, 300)
  }, [])

  const handleSelect = (place) => {
    onChange({ name: place.name, lat: place.lat, lng: place.lng })
    setQuery(place.name)
    setIsOpen(false)
    setResults([])
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setResults([])
  }

  return (
    <div ref={wrapperRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <label style={labelStyle}>
        <MapPin size={10} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: value?.lat ? 28 : 12 }}
        />
        {isLoading && (
          <Search size={12} style={{ position: 'absolute', right: value?.lat ? 28 : 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', opacity: 0.5 }} />
        )}
        {value?.lat && (
          <button type="button" onClick={handleClear} style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 2,
          }}>
            <X size={12} />
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
          borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          {results.map((place, i) => (
            <button key={i} type="button" onClick={() => handleSelect(place)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              borderBottom: i < results.length - 1 ? '1px solid var(--border-secondary)' : 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{place.name}</div>
              {place.address && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.address}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReservationModal({ isOpen, onClose, onSave, reservation, days, places, assignments, selectedDayId, files = [], onFileUpload, onFileDelete }) {
  const toast = useToast()
  const { t, locale } = useTranslation()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    title: '', type: 'other', status: 'pending',
    reservation_time: '', location: '', confirmation_number: '',
    notes: '', assignment_id: '',
    departure: { name: '', lat: null, lng: null },
    destination: { name: '', lat: null, lng: null },
  })
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])

  const assignmentOptions = useMemo(
    () => buildAssignmentOptions(days, assignments, t, locale),
    [days, assignments, t, locale]
  )

  useEffect(() => {
    if (reservation) {
      setForm({
        title: reservation.title || '',
        type: reservation.type || 'other',
        status: reservation.status || 'pending',
        reservation_time: reservation.reservation_time ? reservation.reservation_time.slice(0, 16) : '',
        reservation_end_time: reservation.reservation_end_time || '',
        location: reservation.location || '',
        confirmation_number: reservation.confirmation_number || '',
        notes: reservation.notes || '',
        assignment_id: reservation.assignment_id || '',
        departure: { name: reservation.departure_name || '', lat: reservation.departure_lat || null, lng: reservation.departure_lng || null },
        destination: { name: reservation.destination_name || '', lat: reservation.destination_lat || null, lng: reservation.destination_lng || null },
      })
    } else {
      setForm({
        title: '', type: 'other', status: 'pending',
        reservation_time: '', reservation_end_time: '', location: '', confirmation_number: '',
        notes: '', assignment_id: '',
        departure: { name: '', lat: null, lng: null },
        destination: { name: '', lat: null, lng: null },
      })
      setPendingFiles([])
    }
  }, [reservation, isOpen, selectedDayId])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setIsSaving(true)
    try {
      const { departure, destination, ...rest } = form
      const saved = await onSave({
        ...rest,
        assignment_id: form.assignment_id || null,
        departure_name: departure?.name || null,
        departure_lat: departure?.lat || null,
        departure_lng: departure?.lng || null,
        destination_name: destination?.name || null,
        destination_lat: destination?.lat || null,
        destination_lng: destination?.lng || null,
      })
      if (!reservation?.id && saved?.id && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('reservation_id', saved.id)
          fd.append('description', form.title)
          await onFileUpload(fd)
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (reservation?.id) {
      setUploadingFile(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('reservation_id', reservation.id)
        fd.append('description', reservation.title)
        await onFileUpload(fd)
        toast.success(t('reservations.toast.fileUploaded'))
      } catch {
        toast.error(t('reservations.toast.uploadError'))
      } finally {
        setUploadingFile(false)
        e.target.value = ''
      }
    } else {
      setPendingFiles(prev => [...prev, file])
      e.target.value = ''
    }
  }

  const attachedFiles = reservation?.id ? files.filter(f => f.reservation_id === reservation.id) : []

  const inputStyle = {
    width: '100%', border: '1px solid var(--border-primary)', borderRadius: 10,
    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)', background: 'var(--bg-input)',
  }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.03em' }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={reservation ? t('reservations.editTitle') : t('reservations.newTitle')} size="2xl">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Type selector */}
        <div>
          <label style={labelStyle}>{t('reservations.bookingType')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {TYPE_OPTIONS.map(({ value, labelKey, Icon }) => (
              <button key={value} type="button" onClick={() => set('type', value)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 99, border: '1px solid',
                fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                background: form.type === value ? 'var(--text-primary)' : 'var(--bg-card)',
                borderColor: form.type === value ? 'var(--text-primary)' : 'var(--border-primary)',
                color: form.type === value ? 'var(--bg-primary)' : 'var(--text-muted)',
              }}>
                <Icon size={11} /> {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={labelStyle}>{t('reservations.titleLabel')} *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} required
            placeholder={t('reservations.titlePlaceholder')} style={inputStyle} />
        </div>

        {/* Flight departure/destination pickers */}
        {form.type === 'flight' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <LocationSearchInput
              label={t('reservations.departure')}
              value={form.departure}
              onChange={v => set('departure', v || { name: '', lat: null, lng: null })}
              placeholder={t('reservations.departurePlaceholder')}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />
            <LocationSearchInput
              label={t('reservations.destination')}
              value={form.destination}
              onChange={v => set('destination', v || { name: '', lat: null, lng: null })}
              placeholder={t('reservations.destinationPlaceholder')}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />
          </div>
        )}

        {/* Assignment Picker + Date */}
        <div style={{ display: 'flex', gap: 8 }}>
          {assignmentOptions.length > 0 && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={labelStyle}>
                <Link2 size={10} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                {t('reservations.linkAssignment')}
              </label>
              <CustomSelect
                value={form.assignment_id}
                onChange={value => {
                  set('assignment_id', value)
                  const opt = assignmentOptions.find(o => o.value === value)
                  if (opt?.dayDate) {
                    setForm(prev => {
                      if (prev.reservation_time) return prev
                      return { ...prev, reservation_time: opt.dayDate }
                    })
                  }
                }}
                placeholder={t('reservations.pickAssignment')}
                options={[
                  { value: '', label: t('reservations.noAssignment') },
                  ...assignmentOptions,
                ]}
                searchable
                size="sm"
              />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>{t('reservations.date')}</label>
            <CustomDatePicker
              value={(() => { const [d] = (form.reservation_time || '').split('T'); return d || '' })()}
              onChange={d => {
                const [, t] = (form.reservation_time || '').split('T')
                set('reservation_time', d ? (t ? `${d}T${t}` : d) : '')
              }}
            />
          </div>
        </div>

        {/* Start Time + End Time + Status */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>{t('reservations.startTime')}</label>
            <CustomTimePicker
              value={(() => { const [, t] = (form.reservation_time || '').split('T'); return t || '' })()}
              onChange={t => {
                const [d] = (form.reservation_time || '').split('T')
                const date = d || new Date().toISOString().split('T')[0]
                set('reservation_time', t ? `${date}T${t}` : date)
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>{t('reservations.endTime')}</label>
            <CustomTimePicker value={form.reservation_end_time} onChange={v => set('reservation_end_time', v)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>{t('reservations.status')}</label>
            <CustomSelect
              value={form.status}
              onChange={value => set('status', value)}
              options={[
                { value: 'pending', label: t('reservations.pending') },
                { value: 'confirmed', label: t('reservations.confirmed') },
              ]}
              size="sm"
            />
          </div>
        </div>

        {/* Location + Booking Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>{t('reservations.locationAddress')}</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
              placeholder={t('reservations.locationPlaceholder')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('reservations.confirmationCode')}</label>
            <input type="text" value={form.confirmation_number} onChange={e => set('confirmation_number', e.target.value)}
              placeholder={t('reservations.confirmationPlaceholder')} style={inputStyle} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>{t('reservations.notes')}</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            placeholder={t('reservations.notesPlaceholder')}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
        </div>

        {/* Files */}
        <div>
          <label style={labelStyle}>{t('files.title')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attachedFiles.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.original_name}</span>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-faint)', display: 'flex', flexShrink: 0 }}><ExternalLink size={11} /></a>
                {onFileDelete && (
                  <button type="button" onClick={() => onFileDelete(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 0, flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
            {pendingFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 0, flexShrink: 0 }}>
                  <X size={11} />
                </button>
              </div>
            ))}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              border: '1px dashed var(--border-primary)', borderRadius: 8, background: 'none',
              fontSize: 11, color: 'var(--text-faint)', cursor: uploadingFile ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              <Paperclip size={11} />
              {uploadingFile ? t('reservations.uploading') : t('reservations.attachFile')}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-secondary)' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border-primary)', background: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-muted)' }}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={isSaving || !form.title.trim()} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: isSaving || !form.title.trim() ? 0.5 : 1 }}>
            {isSaving ? t('common.saving') : reservation ? t('common.update') : t('common.add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function formatDate(dateStr, locale) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(locale || 'de-DE', { day: 'numeric', month: 'short' })
}
