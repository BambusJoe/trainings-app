import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Routine } from '../db'
import { useActiveWorkout, useExerciseMap } from '../hooks'
import { startWorkout } from '../logic/workout'
import { fmtRelative } from '../format'
import { Dialog } from '../components/Dialog'
import { Icon } from '../components/Icon'

export default function StartPage() {
  const navigate = useNavigate()
  const active = useActiveWorkout()
  const exercises = useExerciseMap()
  const routines = useLiveQuery(() => db.routines.orderBy('sortOrder').toArray(), [], [])
  const lastByRoutine = useLiveQuery(async () => {
    const m = new Map<number, number>()
    await db.workouts.each((w) => {
      if (w.routineId !== undefined && w.finishedAt && w.startedAt > (m.get(w.routineId) ?? 0)) m.set(w.routineId, w.startedAt)
    })
    return m
  }, [], new Map<number, number>())
  const [blocked, setBlocked] = useState(false)

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

        {routines.length === 0 && (
          <div className="empty">
            <p>Noch keine Routinen.</p>
            <p className="muted">Lege z. B. „Push“, „Pull“ und „Beine“ an. Die Anzahl ist nicht begrenzt.</p>
          </div>
        )}

        <ul className="cards">
          {routines.map((r) => {
            const names = r.items.map((i) => exercises.get(i.exerciseId)?.name).filter(Boolean)
            const last = lastByRoutine.get(r.id)
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
      </section>

      <button className="btn btn-block" onClick={() => start()}>
        Leeres Training starten
      </button>

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
