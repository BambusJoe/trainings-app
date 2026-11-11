import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Routine } from '../db'
import { useActiveWorkout, useExerciseMap } from '../hooks'
import { startWorkout } from '../logic/workout'
import { fmtRelative } from '../format'
import { Dialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { RoutinesFromHistory } from '../components/RoutinesFromHistory'

export default function StartPage() {
  const navigate = useNavigate()
  const active = useActiveWorkout()
  const exercises = useExerciseMap()
  const routines = useLiveQuery(() => db.routines.orderBy('sortOrder').toArray(), [], [])
  // Letztes Training je Routine – per Routine-ID oder (z. B. bei Hevy-Importen) per gleichem Namen
  const history = useLiveQuery(
    async () => {
      const byId = new Map<number, number>()
      const byName = new Map<string, number>()
      let finished = 0
      await db.workouts.each((w) => {
        if (!w.finishedAt) return
        finished++
        if (w.routineId !== undefined && w.startedAt > (byId.get(w.routineId) ?? 0)) byId.set(w.routineId, w.startedAt)
        const k = w.name.trim().toLowerCase()
        if (w.startedAt > (byName.get(k) ?? 0)) byName.set(k, w.startedAt)
      })
      return { byId, byName, finished }
    },
    [],
    { byId: new Map<number, number>(), byName: new Map<string, number>(), finished: 0 },
  )
  const [blocked, setBlocked] = useState(false)
  const [fromHistory, setFromHistory] = useState(false)
  const [created, setCreated] = useState<number | null>(null)

  async function start(routine?: Routine) {
    if (active) {
      setBlocked(true)
      return
    }
    await startWorkout(routine)
    navigate('/training')
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Training</h1>
      </header>

      <section className="section">
        <div className="section-head">
          <h2>Routinen</h2>
          <Link className="btn btn-small" to="/routine/neu">
            <Icon name="plus" size={18} /> Neue Routine
          </Link>
        </div>

        {created !== null && (
          <div className="notice" role="status">
            <span>{created === 0 ? 'Keine neuen Routinen angelegt.' : created === 1 ? '1 Routine angelegt.' : `${created} Routinen angelegt.`} Tippe eine Routine an, um sie anzupassen.</span>
            <button className="icon-btn" onClick={() => setCreated(null)} aria-label="Hinweis schließen">
              <Icon name="close" size={18} />
            </button>
          </div>
        )}

        {routines.length === 0 && (
          <div className="empty">
            <p>Noch keine Routinen.</p>
            {history.finished > 0 ? (
              <>
                <p className="muted">Dein Tagebuch hat schon {history.finished} Trainings. Daraus kann ich Routinen mit deinen letzten Gewichten erstellen.</p>
                <button className="btn btn-primary" onClick={() => setFromHistory(true)}>
                  Routinen aus Tagebuch erstellen
                </button>
              </>
            ) : (
              <p className="muted">Lege z. B. „Push“, „Pull“ und „Beine“ an. Die Anzahl ist nicht begrenzt.</p>
            )}
          </div>
        )}

        <ul className="cards">
          {routines.map((r) => {
            const names = r.items.map((i) => exercises.get(i.exerciseId)?.name).filter(Boolean)
            const last = history.byId.get(r.id) ?? history.byName.get(r.name.trim().toLowerCase())
            return (
              <li key={r.id} className="card routine-card">
                <Link to={`/routine/${r.id}`} className="routine-card-main">
                  <div className="routine-card-title">
                    <h3>{r.name}</h3>
                    {last && <span className="muted small">{fmtRelative(last)}</span>}
                  </div>
                  <p className="muted small clamp-2">{names.length ? names.join(' · ') : 'Keine Übungen'}</p>
                </Link>
                <button className="btn btn-tinted" onClick={() => start(r)} aria-label={`${r.name} starten`}>
                  <Icon name="play" size={16} /> Start
                </button>
              </li>
            )
          })}
        </ul>

        {routines.length > 0 && history.finished > 0 && (
          <button className="btn btn-ghost btn-small routine-from-history" onClick={() => setFromHistory(true)}>
            Weitere Routinen aus Tagebuch erstellen
          </button>
        )}
      </section>

      <button className="btn btn-block" onClick={() => start()}>
        Leeres Training starten
      </button>

      {fromHistory && (
        <RoutinesFromHistory
          onClose={() => setFromHistory(false)}
          onDone={(n) => {
            setFromHistory(false)
            setCreated(n)
          }}
        />
      )}

      {blocked && (
        <Dialog
          title="Es läuft bereits ein Training"
          onClose={() => setBlocked(false)}
          actions={[{ label: 'Zum laufenden Training', kind: 'primary', onClick: () => navigate('/training') }]}
        >
          <p>Beende oder verwirf zuerst „{active?.name}“.</p>
        </Dialog>
      )}
    </div>
  )
}
