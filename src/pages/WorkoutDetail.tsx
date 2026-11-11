import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useExerciseMap } from '../hooks'
import { addExerciseToWorkout, deleteWorkout } from '../logic/workout'
import { workoutVolume } from '../logic/stats'
import { ExerciseBlock, groupSets } from '../components/ExerciseBlock'
import { ExercisePicker } from '../components/ExercisePicker'
import { Dialog } from '../components/Dialog'
import { fmtDate, fmtDuration, fmtInt, fmtSet, fmtTime } from '../format'
import { Icon } from '../components/Icon'

export default function WorkoutDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const exercises = useExerciseMap()
  const workout = useLiveQuery(() => db.workouts.get(id), [id], null)
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(id).toArray(), [id], [])
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (workout === null) return null
  if (!workout) {
    return (
      <div className="page">
        <div className="empty">
          <p>Training nicht gefunden.</p>
          <Link className="btn" to="/tagebuch">
            Zum Tagebuch
          </Link>
        </div>
      </div>
    )
  }

  const groups = groupSets(sets)

  async function finishEditing() {
    // leere Sätze (ohne Wiederholungen) entfernen
    await db.sets.bulkDelete(sets.filter((s) => !s.done).map((s) => s.id))
    setEditing(false)
  }

  return (
    <div className="page">
      <header className="page-head page-head-bar">
        <button className={`btn btn-small ${editing ? 'btn-primary' : 'btn-ghost'}`} onClick={() => (editing ? finishEditing() : navigate('/tagebuch'))}>
          {editing ? (
            'Fertig'
          ) : (
            <>
              <Icon name="chevronLeft" size={18} strokeWidth={2.5} /> Tagebuch
            </>
          )}
        </button>
        <span />
        {!editing && (
          <button className="btn btn-small" onClick={() => setEditing(true)}>
            Bearbeiten
          </button>
        )}
      </header>

      {editing ? (
        <input className="input title-input" value={workout.name} onChange={(e) => db.workouts.update(id, { name: e.target.value })} aria-label="Name des Trainings" />
      ) : (
        <h1>{workout.name}</h1>
      )}
      <p className="muted">
        {fmtDate(workout.startedAt)}, {fmtTime(workout.startedAt)} Uhr
        {workout.source === 'hevy' && ' · aus Hevy'}
      </p>

      <div className="stat-tiles">
        <div className="stat">
          <span className="stat-value">{fmtDuration((workout.finishedAt ?? workout.startedAt) - workout.startedAt, true)}</span>
          <span className="stat-label">Dauer</span>
        </div>
        <div className="stat">
          <span className="stat-value">{sets.filter((s) => s.done && !s.isWarmup).length}</span>
          <span className="stat-label">Sätze</span>
        </div>
        <div className="stat">
          <span className="stat-value">{fmtInt(workoutVolume(sets))}</span>
          <span className="stat-label">Volumen kg</span>
        </div>
      </div>

      {editing ? (
        <>
          {groups.map(([order, list], idx) => (
            <ExerciseBlock
              key={order}
              mode="edit"
              workoutId={id}
              exerciseOrder={order}
              exercise={exercises.get(list[0].exerciseId)}
              sets={list}
              isFirst={idx === 0}
              isLast={idx === groups.length - 1}
            />
          ))}
          <button className="btn btn-block" onClick={() => setPicking(true)}>
            <Icon name="plus" size={18} /> Übung hinzufügen
          </button>
          <label className="field">
            <span className="field-label">Notiz zum Training</span>
            <textarea className="input textarea" rows={3} value={workout.notes} onChange={(e) => db.workouts.update(id, { notes: e.target.value })} />
          </label>
          <button className="btn btn-block btn-ghost btn-danger-text" onClick={() => setConfirmDelete(true)}>
            Training löschen
          </button>
        </>
      ) : (
        <>
          {workout.notes && (
            <div className="workout-notes">
              <span className="field-label">Notiz</span>
              <p>{workout.notes}</p>
            </div>
          )}
          {groups.map(([order, list]) => {
            const ex = exercises.get(list[0].exerciseId)
            let n = 0
            return (
              <section key={order} className="card">
                <Link to={`/uebungen/${list[0].exerciseId}`} className="exercise-name">
                  {ex?.name ?? '…'}
                </Link>
                <ol className="set-list">
                  {list
                    .sort((a, b) => a.setIndex - b.setIndex)
                    .map((s) => (
                      <li key={s.id} className={s.isWarmup ? 'muted' : ''}>
                        <span className="set-list-no">{s.isWarmup ? 'A' : ++n}</span>
                        <span>{fmtSet(s.weight, s.reps)}</span>
                      </li>
                    ))}
                </ol>
              </section>
            )
          })}
        </>
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (ids) => {
            setPicking(false)
            for (const exId of ids) await addExerciseToWorkout(id, exId)
          }}
        />
      )}
      {confirmDelete && (
        <Dialog
          title="Training löschen?"
          onClose={() => setConfirmDelete(false)}
          actions={[
            {
              label: 'Endgültig löschen',
              kind: 'danger',
              onClick: async () => {
                await deleteWorkout(id)
                navigate('/tagebuch', { replace: true })
              },
            },
          ]}
        >
          <p>Das Training und alle seine Sätze werden gelöscht. Das lässt sich nicht rückgängig machen.</p>
        </Dialog>
      )}
    </div>
  )
}
