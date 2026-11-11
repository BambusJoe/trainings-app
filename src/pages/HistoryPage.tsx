import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Workout, type WorkoutSet } from '../db'
import { useExerciseMap } from '../hooks'
import { workoutVolume } from '../logic/stats'
import { fmtDate, fmtDuration, fmtInt } from '../format'

interface Entry {
  workout: Workout
  sets: WorkoutSet[]
}

export default function HistoryPage() {
  const exercises = useExerciseMap()
  const entries = useLiveQuery(async (): Promise<Entry[]> => {
    const workouts = (await db.workouts.orderBy('startedAt').reverse().toArray()).filter((w) => w.finishedAt !== undefined)
    const sets = await db.sets.toArray()
    const byWorkout = new Map<number, WorkoutSet[]>()
    for (const s of sets) byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s])
    return workouts.map((w) => ({ workout: w, sets: byWorkout.get(w.id) ?? [] }))
  }, [])

  if (!entries) return null

  // nach Monat gruppieren
  const months: { label: string; items: Entry[] }[] = []
  for (const e of entries) {
    const label = new Date(e.workout.startedAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    const m = months[months.length - 1]
    if (m?.label === label) m.items.push(e)
    else months.push({ label, items: [e] })
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Tagebuch</h1>
        {entries.length > 0 && <span className="muted">{entries.length} Trainings</span>}
      </header>

      {entries.length === 0 && (
        <div className="empty">
          <p>Noch keine Trainings.</p>
          <p className="muted">Abgeschlossene Trainings erscheinen hier. Deinen Hevy-Verlauf kannst du unter „Mehr“ importieren.</p>
        </div>
      )}

      {months.map((m) => (
        <section key={m.label} className="section">
          <h2 className="month-label">{m.label}</h2>
          <ul className="cards">
            {m.items.map(({ workout: w, sets }) => {
              const order = [...new Set(sets.sort((a, b) => a.exerciseOrder - b.exerciseOrder).map((s) => s.exerciseId))]
              const counted = sets.filter((s) => s.done && !s.isWarmup)
              return (
                <li key={w.id}>
                  <Link to={`/tagebuch/${w.id}`} className="card history-card">
                    <div className="row-between">
                      <h3>{w.name}</h3>
                      <span className="muted small">{fmtDate(w.startedAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="stats-inline small">
                      <span>{fmtDuration((w.finishedAt ?? w.startedAt) - w.startedAt)}</span>
                      <span>{counted.length} Sätze</span>
                      <span>{fmtInt(workoutVolume(sets))} kg</span>
                    </div>
                    <p className="muted small clamp-2">{order.map((id) => exercises.get(id)?.name).filter(Boolean).join(' · ')}</p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
