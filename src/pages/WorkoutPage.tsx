import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useActiveWorkout, useDefaultRest, useExerciseMap, useNow } from '../hooks'
import { addExerciseToWorkout, deleteWorkout, differsFromRoutine, finishWorkout } from '../logic/workout'
import { ExerciseBlock, groupSets } from '../components/ExerciseBlock'
import { ExercisePicker } from '../components/ExercisePicker'
import { Dialog } from '../components/Dialog'
import { useRestTimer } from '../components/RestTimer'
import { fmtClock } from '../format'
import { Icon } from '../components/Icon'

type FinishDialog = 'empty' | 'routine' | 'confirm' | 'discard' | null

export default function WorkoutPage() {
  const navigate = useNavigate()
  const workout = useActiveWorkout()
  const exercises = useExerciseMap()
  const defaultRest = useDefaultRest()
  const timer = useRestTimer()
  const now = useNow(!!workout)
  const sets = useLiveQuery(() => (workout ? db.sets.where('workoutId').equals(workout.id).toArray() : []), [workout?.id], [])
  const routine = useLiveQuery(() => (workout?.routineId !== undefined ? db.routines.get(workout.routineId) : undefined), [workout?.routineId])
  const [picking, setPicking] = useState(false)
  const [dialog, setDialog] = useState<FinishDialog>(null)

  if (workout === null) return null // lädt noch
  if (!workout) {
    return (
      <div className="page">
        <div className="empty">
          <p>Gerade läuft kein Training.</p>
          <Link className="btn btn-primary" to="/">
            Zur Übersicht
          </Link>
        </div>
      </div>
    )
  }

  const groups = groupSets(sets)
  const doneSets = sets.filter((s) => s.done)
  const openSets = sets.length - doneSets.length

  function restFor(exerciseId: number) {
    return routine?.items.find((i) => i.exerciseId === exerciseId)?.restSeconds ?? defaultRest
  }

  function requestFinish() {
    if (doneSets.length === 0) setDialog('empty')
    else if (routine && differsFromRoutine(doneSets, routine)) setDialog('routine')
    else setDialog('confirm')
  }

  async function finish(updateRoutine: boolean) {
    const id = workout!.id
    timer.stop()
    await finishWorkout(id, { updateRoutine })
    navigate(`/tagebuch/${id}`, { replace: true })
  }

  async function discard() {
    timer.stop()
    await deleteWorkout(workout!.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="page page-workout">
      <header className="workout-head">
        <button className="btn btn-ghost btn-small" onClick={() => navigate('/')} aria-label="Training minimieren">
          <Icon name="chevronLeft" size={18} strokeWidth={2.5} /> Übersicht
        </button>
        <span className="workout-clock" aria-label="Trainingsdauer">
          {fmtClock(now - workout.startedAt)}
        </span>
        <button className="btn btn-primary btn-small" onClick={requestFinish}>
          Beenden
        </button>
      </header>

      <input className="input title-input" value={workout.name} onChange={(e) => db.workouts.update(workout.id, { name: e.target.value })} aria-label="Name des Trainings" />

      {groups.map(([order, groupSetsList], idx) => {
        const exerciseId = groupSetsList[0].exerciseId
        return (
          <ExerciseBlock
            key={order}
            mode="live"
            workoutId={workout.id}
            exerciseOrder={order}
            exercise={exercises.get(exerciseId)}
            sets={groupSetsList}
            isFirst={idx === 0}
            isLast={idx === groups.length - 1}
            onSetDone={() => {
              timer.unlockAudio()
              timer.start(restFor(exerciseId))
            }}
          />
        )
      })}

      {groups.length === 0 && <p className="muted center">Füge deine erste Übung hinzu.</p>}

      <button className="btn btn-block" onClick={() => setPicking(true)}>
        <Icon name="plus" size={18} /> Übung hinzufügen
      </button>

      <label className="field">
        <span className="field-label">Notiz zum Training</span>
        <textarea className="input textarea" rows={2} value={workout.notes} onChange={(e) => db.workouts.update(workout.id, { notes: e.target.value })} placeholder="Wie lief's? Schlaf, Energie, Schmerzen …" />
      </label>

      <button className="btn btn-block btn-ghost btn-danger-text" onClick={() => setDialog('discard')}>
        Training verwerfen
      </button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (ids) => {
            setPicking(false)
            for (const exId of ids) await addExerciseToWorkout(workout.id, exId)
          }}
        />
      )}

      {dialog === 'empty' && (
        <Dialog title="Keine Sätze abgehakt" onClose={() => setDialog(null)} actions={[{ label: 'Training verwerfen', kind: 'danger', onClick: discard }]}>
          <p>Hake erledigte Sätze mit ✓ ab. Ohne abgehakte Sätze wird nichts gespeichert.</p>
        </Dialog>
      )}
      {dialog === 'routine' && (
        <Dialog
          title={`Routine „${routine?.name}“ anpassen?`}
          onClose={() => setDialog(null)}
          actions={[
            { label: 'Ja, Routine aktualisieren', kind: 'primary', onClick: () => finish(true) },
            { label: 'Nein, Routine so lassen', onClick: () => finish(false) },
          ]}
        >
          <p>Heute weichen Gewichte, Wiederholungen oder Übungen von der Routine ab. Sollen die heutigen Werte die neuen Sollwerte werden? Übersprungene Übungen bleiben in der Routine.</p>
          {openSets > 0 && <p className="muted">{openSets} nicht abgehakte Sätze werden verworfen.</p>}
        </Dialog>
      )}
      {dialog === 'confirm' && (
        <Dialog title="Training beenden?" onClose={() => setDialog(null)} actions={[{ label: 'Beenden & speichern', kind: 'primary', onClick: () => finish(false) }]}>
          <p>{doneSets.length} Sätze abgehakt.</p>
          {openSets > 0 && <p className="muted">{openSets} nicht abgehakte Sätze werden verworfen.</p>}
        </Dialog>
      )}
      {dialog === 'discard' && (
        <Dialog title="Training verwerfen?" onClose={() => setDialog(null)} actions={[{ label: 'Verwerfen', kind: 'danger', onClick: discard }]}>
          <p>Alle Eingaben dieses Trainings werden gelöscht.</p>
        </Dialog>
      )}
    </div>
  )
}
