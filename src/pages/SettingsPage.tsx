import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../db'
import { useDefaultRest } from '../hooks'
import { parseHevyCsv, importHevyWorkouts, type ParseResult } from '../logic/hevy'
import { backupFileName, createBackup, restoreBackup, validateBackup, type Backup } from '../logic/backup'
import { Dialog } from '../components/Dialog'
import { REST_OPTIONS } from './RoutineEditor'
import { fmtDate, fmtRest, fmtShortDate } from '../format'
import { Icon } from '../components/Icon'

export default function SettingsPage() {
  const defaultRest = useDefaultRest()
  const lastBackup = useLiveQuery(() => db.settings.get('lastBackup'), [])
  const counts = useLiveQuery(async () => ({ workouts: await db.workouts.count(), exercises: await db.exercises.count(), routines: await db.routines.count() }), [])
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [hevyPreview, setHevyPreview] = useState<ParseResult | null>(null)
  const [backupPreview, setBackupPreview] = useState<Backup | null>(null)
  const hevyInput = useRef<HTMLInputElement>(null)
  const backupInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  async function onHevyFile(file: File | undefined) {
    if (!file) return
    try {
      const result = parseHevyCsv(await file.text())
      if (result.workouts.length === 0) throw new Error('In der Datei wurden keine Trainings gefunden.')
      setHevyPreview(result)
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true })
    }
    if (hevyInput.current) hevyInput.current.value = ''
  }

  async function doHevyImport() {
    const r = await importHevyWorkouts(hevyPreview!.workouts)
    setHevyPreview(null)
    setMessage({
      text: `${r.workoutsAdded} Trainings mit ${r.setsAdded} Sätzen importiert, ${r.exercisesCreated} neue Übungen.${r.duplicatesSkipped ? ` ${r.duplicatesSkipped} waren schon vorhanden.` : ''}`,
    })
  }

  async function exportBackup() {
    const backup = await createBackup()
    const name = backupFileName()
    const file = new File([JSON.stringify(backup)], name, { type: 'application/json' })
    try {
      // iPhone: Teilen-Dialog → „In Dateien sichern“, AirDrop, Mail …
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Trainings-Backup' })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      await setSetting('lastBackup', Date.now())
      setMessage({ text: 'Backup erstellt.' })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage({ text: `Backup fehlgeschlagen: ${(e as Error).message}`, error: true })
    }
  }

  async function onBackupFile(file: File | undefined) {
    if (!file) return
    try {
      setBackupPreview(validateBackup(JSON.parse(await file.text())))
    } catch (e) {
      setMessage({ text: e instanceof SyntaxError ? 'Die Datei ist kein gültiges Backup.' : (e as Error).message, error: true })
    }
    if (backupInput.current) backupInput.current.value = ''
  }

  async function doRestore() {
    await restoreBackup(backupPreview)
    setBackupPreview(null)
    setMessage({ text: 'Backup wiederhergestellt.' })
  }

  const hevyStats = hevyPreview && {
    workouts: hevyPreview.workouts.length,
    sets: hevyPreview.workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
    from: hevyPreview.workouts[0]?.startedAt,
    to: hevyPreview.workouts[hevyPreview.workouts.length - 1]?.startedAt,
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Mehr</h1>
      </header>

      {message && (
        <div className={`notice ${message.error ? 'notice-error' : ''}`} role="status">
          <span>{message.text}</span>
          <button className="icon-btn" onClick={() => setMessage(null)} aria-label="Hinweis schließen">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      <section className="section">
        <h2>Training</h2>
        <div className="card row-between">
          <span>Standard-Pausenzeit</span>
          <select className="select" value={defaultRest} onChange={(e) => setSetting('defaultRest', Number(e.target.value))}>
            {REST_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {fmtRest(s)}
              </option>
            ))}
          </select>
        </div>
        <p className="muted small">Gilt für leere Trainings und neu hinzugefügte Übungen. In Routinen stellst du die Pause pro Übung ein.</p>
      </section>

      <section className="section">
        <h2>Datensicherung</h2>
        <div className="card stack">
          <p className="small">
            Deine Daten liegen nur auf diesem Gerät.{' '}
            {lastBackup ? <>Letztes Backup: {fmtDate(lastBackup.value as number)}.</> : <b>Noch kein Backup erstellt.</b>}
          </p>
          <button className="btn btn-primary btn-block" onClick={exportBackup}>
            Backup exportieren
          </button>
          <button className="btn btn-block" onClick={() => backupInput.current?.click()}>
            Backup wiederherstellen
          </button>
          <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={(e) => onBackupFile(e.target.files?.[0])} />
          {persisted === false && <p className="muted small">Tipp: Füge die App zum Home-Bildschirm hinzu, damit iOS die Daten dauerhaft behält.</p>}
        </div>
      </section>

      <section className="section">
        <h2>Aus Hevy importieren</h2>
        <div className="card stack">
          <p className="small">
            In Hevy: <b>Profil → Einstellungen → Daten exportieren</b>. Die CSV-Datei hier auswählen. Bereits importierte Trainings werden übersprungen.
          </p>
          <button className="btn btn-block" onClick={() => hevyInput.current?.click()}>
            Hevy-CSV auswählen
          </button>
          <input ref={hevyInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => onHevyFile(e.target.files?.[0])} />
        </div>
      </section>

      {counts && (
        <p className="muted small center">
          {counts.workouts} Trainings · {counts.exercises} Übungen · {counts.routines} Routinen
        </p>
      )}

      {hevyPreview && hevyStats && (
        <Dialog title="Hevy-Daten importieren?" onClose={() => setHevyPreview(null)} actions={[{ label: 'Importieren', kind: 'primary', onClick: doHevyImport }]}>
          <p>
            {hevyStats.workouts} Trainings mit {hevyStats.sets} Sätzen
            {hevyStats.from && hevyStats.to && ` (${fmtShortDate(hevyStats.from)} – ${fmtShortDate(hevyStats.to)})`}.
          </p>
          {hevyPreview.skippedRows > 0 && <p className="muted small">{hevyPreview.skippedRows} Zeilen ohne Wiederholungen (z. B. Zeit- oder Cardio-Übungen) werden übersprungen.</p>}
        </Dialog>
      )}
      {backupPreview && (
        <Dialog title="Backup wiederherstellen?" onClose={() => setBackupPreview(null)} actions={[{ label: 'Alles ersetzen', kind: 'danger', onClick: doRestore }]}>
          <p>
            Backup vom {fmtDate(Date.parse(backupPreview.exportedAt))} mit {backupPreview.data.workouts.length} Trainings.
          </p>
          <p className="muted">Alle aktuellen Daten auf diesem Gerät werden dadurch ersetzt.</p>
        </Dialog>
      )}
    </div>
  )
}
