import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getOrCreateExercise } from '../db'
import { fmtRelative } from '../format'
import { Icon } from '../components/Icon'

export default function ExercisesPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const data = useLiveQuery(async () => {
    const [exercises, sets, workouts] = await Promise.all([db.exercises.toArray(), db.sets.toArray(), db.workouts.toArray()])
    const finished = new Map(workouts.filter((w) => w.finishedAt !== undefined).map((w) => [w.id, w.startedAt]))
    const info = new Map<number, { last: number; sessions: Set<number> }>()
    for (const s of sets) {
      const t = finished.get(s.workoutId)
      if (t === undefined || !s.done) continue
      const i = info.get(s.exerciseId) ?? { last: 0, sessions: new Set<number>() }
      i.last = Math.max(i.last, t)
      i.sessions.add(s.workoutId)
      info.set(s.exerciseId, i)
    }
    return exercises.map((e) => ({ ...e, last: info.get(e.id)?.last ?? 0, count: info.get(e.id)?.sessions.size ?? 0 }))
  }, [])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data ?? []).filter((e) => !needle || e.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [data, q])

  const exact = (data ?? []).some((e) => e.name.toLowerCase() === q.trim().toLowerCase())

  return (
    <div className="page">
      <header className="page-head">
        <h1>Übungen</h1>
      </header>
      <input className="input" type="search" placeholder="Suchen oder neue Übung anlegen" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && !exact && (
        <button
          className="list-row list-row-create"
          onClick={async () => {
            const id = await getOrCreateExercise(q)
            navigate(`/uebungen/${id}`)
          }}
        >
          <Icon name="plus" size={18} /> „{q.trim()}“ anlegen
        </button>
      )}
      <ul className="list">
        {list.map((e) => (
          <li key={e.id}>
            <Link to={`/uebungen/${e.id}`} className="list-row">
              <span>{e.name}</span>
              <span className="muted small">{e.count ? `${e.count}× · ${fmtRelative(e.last)}` : 'noch nie'}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data && data.length === 0 && !q && <p className="muted center">Noch keine Übungen. Lege oben eine an oder importiere deinen Hevy-Verlauf unter „Mehr“.</p>}
    </div>
  )
}
