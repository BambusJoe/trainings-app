const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const int = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

export function fmtWeight(w: number | null | undefined): string {
  return w === null || w === undefined ? '–' : num.format(w)
}

export function fmtInt(n: number): string {
  return int.format(n)
}

/** "80 × 8" bzw. "× 12" bei Körpergewicht */
export function fmtSet(weight: number | null, reps: number | null): string {
  if (reps === null) return '–'
  return weight === null || weight === 0 ? `${reps} Wdh.` : `${fmtWeight(weight)} kg × ${reps}`
}

export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function fmtDate(ts: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(ts).toLocaleDateString('de-DE', opts)
}

export function fmtShortDate(ts: number) {
  const d = new Date(ts)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('de-DE', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: '2-digit' })
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDuration(ms: number, compact = false): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (compact) return h ? `${h}:${String(m).padStart(2, '0')} h` : `${m} min`
  return h ? `${h} h ${m} min` : `${m} min`
}

/** mm:ss bzw. h:mm:ss */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function fmtRelative(ts: number): string {
  const days = Math.floor((startOfDay(Date.now()) - startOfDay(ts)) / 86400000)
  if (days <= 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  if (days < 14) return 'vor 1 Woche'
  if (days < 60) return `vor ${Math.floor(days / 7)} Wochen`
  return fmtShortDate(ts)
}

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function fmtRest(seconds: number): string {
  if (seconds === 0) return 'aus'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m ? (s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`) : `${s} s`
}

/** Kompakt für enge Spalten: "90 × 8" */
export function fmtSetShort(weight: number | null, reps: number | null): string {
  if (reps === null) return '–'
  return weight === null || weight === 0 ? `× ${reps}` : `${fmtWeight(weight)} × ${reps}`
}
