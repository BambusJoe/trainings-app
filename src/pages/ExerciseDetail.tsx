import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { computeRecords, exerciseHistory } from '../logic/stats'
import { ProgressChart } from '../components/ProgressChart'
import { Dialog } from '../components/Dialog'
import { MUSCLES } from '../data/exercisePool'
import { fmtDate, fmtInt, fmtSet, fmtShortDate, fmtWeight } from '../format'
import { Icon } from '../components/Icon'

type Metric = 'best1RM' | 'bestWeight' | 'volume'
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'best1RM', label: 'Gesch. 1RM', unit: 'kg' },
  { key: 'bestWeight', label: 'Max. Gewicht', unit: 'kg' },
  { key: 'volume', label: 'Volumen', unit: 'kg' },
]

export default function ExerciseDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const exercise = useLiveQuery(() => db.exercises.get(id), [id], null)
  const history = useLiveQuery(() => exerciseHistory(id), [id])
  const usedCount = useLiveQuery(() => db.sets.where('exerciseId').equals(id).count(), [id], 0)
  const [metric, setMetric] = useState<Metric>('best1RM')
  const [rename, setRename] = useState<string | null>(null)
  const [renameError, setRenameError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (exercise === null || !history) return null
  if (!exercise) {
    return (
      <div className="page">
        <div className="empty">
          <p>Übung nicht gefunden.</p>
          <Link className="btn" to="/uebungen">
            Zu den Übungen
          </Link>
        </div>
      </div>
    )
  }

  const records = computeRecords(history)
  const m = METRICS.find((x) => x.key === metric)!

  async function saveName() {
    const name = rename!.trim()
    if (!name) return
    const clash = await db.exercises.filter((e) => e.id !== id && e.name.toLowerCase() === name.toLowerCase()).first()
    if (clash) {
      setRenameError('Eine Übung mit diesem Namen gibt es schon.')
      return
    }
    await db.exercises.update(id, { name })
    setRename(null)
  }

  async function remove() {
    // aus Routinen entfernen, dann löschen
    await db.transaction('rw', db.routines, db.exercises, async () => {
      const routines = await db.routines.toArray()
      for (const r of routines) {
        if (r.items.some((i) => i.exerciseId === id)) await db.routines.update(r.id, { items: r.items.filter((i) => i.exerciseId !== id) })
      }
      await db.exercises.delete(id)
    })
    navigate('/uebungen', { replace: true })
  }

  return (
    <div className="page">
      <header className="page-head page-head-bar">
        <button className="btn btn-ghost btn-small" onClick={() => navigate(-1)}>
          <Icon name="chevronLeft" size={18} strokeWidth={2.5} /> Zurück
        </button>
        <span />
        <button className="btn btn-small" onClick={() => (setRename(exercise.name), setRenameError(''))}>
          Umbenennen
        </button>
      </header>

      <h1>{exercise.name}</h1>

      <label className="card row-between">
        <span>Muskelgruppe</span>
        <select className="select" value={exercise.muscle ?? ''} onChange={(e) => db.exercises.update(id, { muscle: e.target.value || undefined })}>
          <option value="">keine</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Notiz</span>
        <textarea className="input textarea" rows={2} value={exercise.notes} onChange={(e) => db.exercises.update(id, { notes: e.target.value })} placeholder="z. B. Sitzeinstellung, Griff, Hinweise" />
      </label>

      {history.length > 0 ? (
        <>
          <section className="section">
            <div className="segmented" role="tablist">
              {METRICS.map((x) => (
                <button key={x.key} role="tab" aria-selected={metric === x.key} className={metric === x.key ? 'seg-on' : ''} onClick={() => setMetric(x.key)}>
                  {x.label}
                </button>
              ))}
            </div>
            <ProgressChart key={metric} unit={m.unit} points={history.map((h) => ({ date: h.date, value: h[metric] }))} />
          </section>

          <section className="section">
            <h2>Rekorde</h2>
            <div className="stat-tiles stat-tiles-2">
              {records.heaviest && (
                <div className="stat">
                  <span className="stat-value">{fmtWeight(records.heaviest.weight)} kg</span>
                  <span className="stat-label">
                    Max. Gewicht · {records.heaviest.reps} Wdh. · {fmtShortDate(records.heaviest.date)}
                  </span>
                </div>
              )}
              {records.best1RM && (
                <div className="stat">
                  <span className="stat-value">{fmtWeight(records.best1RM.value)} kg</span>
                  <span className="stat-label">
                    Geschätztes 1RM · {fmtSet(records.best1RM.weight, records.best1RM.reps)}
                  </span>
                </div>
              )}
              {records.mostReps && (
                <div className="stat">
                  <span className="stat-value">{records.mostReps.reps} Wdh.</span>
                  <span className="stat-label">
                    Meiste Wdh. · {fmtWeight(records.mostReps.weight)} kg · {fmtShortDate(records.mostReps.date)}
                  </span>
                </div>
              )}
              {records.bestVolume && (
                <div className="stat">
                  <span className="stat-value">{fmtInt(records.bestVolume.volume)} kg</span>
                  <span className="stat-label">Bestes Volumen · {fmtShortDate(records.bestVolume.date)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="section">
            <h2>Verlauf</h2>
            <ul className="cards">
              {[...history].reverse().map((h) => (
                <li key={h.workoutId}>
                  <Link to={`/tagebuch/${h.workoutId}`} className="card history-row">
                    <span className="small muted">{fmtDate(h.date)}</span>
                    <span>{h.sets.map((s) => fmtSet(s.weight, s.reps)).join(', ')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="muted center">Noch kein abgeschlossenes Training mit dieser Übung.</p>
      )}

      {usedCount === 0 && (
        <button className="btn btn-block btn-ghost btn-danger-text" onClick={() => setConfirmDelete(true)}>
          Übung löschen
        </button>
      )}

      {rename !== null && (
        <Dialog title="Übung umbenennen" onClose={() => setRename(null)} actions={[{ label: 'Speichern', kind: 'primary', onClick: saveName }]}>
          <input className="input" value={rename} onChange={(e) => setRename(e.target.value)} autoFocus />
          {renameError && <p className="error small">{renameError}</p>}
        </Dialog>
      )}
      {confirmDelete && (
        <Dialog title={`„${exercise.name}“ löschen?`} onClose={() => setConfirmDelete(false)} actions={[{ label: 'Löschen', kind: 'danger', onClick: remove }]}>
          <p>Die Übung wird auch aus allen Routinen entfernt.</p>
        </Dialog>
      )}
    </div>
  )
}
