import { useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Exercise, type WorkoutSet } from '../db'
import { lastPerformance } from '../logic/stats'
import { addSet, moveExerciseInWorkout, removeExerciseFromWorkout, removeSet } from '../logic/workout'
import { fmtRelative, fmtSet, fmtSetShort, fmtWeight } from '../format'
import { NumberField } from './NumberField'
import { Dialog } from './Dialog'
import { Icon } from './Icon'

interface Props {
  workoutId: number
  exerciseOrder: number
  exercise: Exercise | undefined
  sets: WorkoutSet[]
  isFirst: boolean
  isLast: boolean
  /** live = laufendes Training mit Haken & Timer, edit = abgeschlossenes Training nachbearbeiten */
  mode: 'live' | 'edit'
  onSetDone?: () => void
}

export function ExerciseBlock({ workoutId, exerciseOrder, exercise, sets, isFirst, isLast, mode, onSetDone }: Props) {
  const exerciseId = sets[0]?.exerciseId
  const last = useLiveQuery(() => (mode === 'live' && exerciseId !== undefined ? lastPerformance(exerciseId, workoutId) : null), [exerciseId, workoutId, mode])
  const [menu, setMenu] = useState(false)
  const [setMenuFor, setSetMenuFor] = useState<WorkoutSet | null>(null)
  const [noteEdit, setNoteEdit] = useState<string | null>(null)
  const [needReps, setNeedReps] = useState<number | null>(null)

  const sorted = [...sets].sort((a, b) => a.setIndex - b.setIndex)
  const prevFor = matchPrevious(sorted, last?.sets ?? [])
  let workingNo = 0

  async function toggle(stale: WorkoutSet) {
    // frisch aus der DB lesen – die letzte Eingabe ist evtl. noch nicht neu gerendert
    const s = (await db.sets.get(stale.id)) ?? stale
    if (s.done) {
      await db.sets.update(s.id, { done: false })
      return
    }
    const prev = prevFor.get(s.id)
    const weight = s.weight ?? prev?.weight ?? null
    const reps = s.reps ?? prev?.reps ?? null
    if (reps === null || reps <= 0) {
      setNeedReps(s.id)
      setTimeout(() => setNeedReps(null), 1200)
      return
    }
    await db.sets.update(s.id, { weight, reps, done: true })
    onSetDone?.()
  }

  async function commit(s: WorkoutSet, patch: Partial<WorkoutSet>) {
    const next = { ...s, ...patch }
    // Im Bearbeiten-Modus zählt ein Satz, sobald Wiederholungen eingetragen sind
    if (mode === 'edit') patch.done = (next.reps ?? 0) > 0
    await db.sets.update(s.id, patch)
  }

  return (
    <section className="card exercise-block">
      <div className="row-between">
        <Link to={`/uebungen/${exerciseId}`} className="exercise-name">
          {exercise?.name ?? '…'}
        </Link>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Übungsoptionen">
          <Icon name="more" />
        </button>
      </div>

      {exercise?.notes ? (
        <button className="exercise-note" onClick={() => setNoteEdit(exercise.notes)}>
          {exercise.notes}
        </button>
      ) : null}

      {mode === 'live' && (
        <p className="muted small last-line">
          {last ? (
            <>
              Letztes Mal {fmtRelative(last.workout.startedAt)}: {last.sets.filter((s) => !s.isWarmup).map((s) => fmtSet(s.weight, s.reps)).join(', ') || '–'}
            </>
          ) : (
            'Zum ersten Mal'
          )}
        </p>
      )}

      <div className={`set-table ${mode === 'edit' ? 'set-table-edit' : ''}`}>
        <div className="set-row set-head">
          <span>Satz</span>
          {mode === 'live' && <span>Zuletzt</span>}
          <span>kg</span>
          <span>Wdh.</span>
          {mode === 'live' && <span aria-hidden="true" />}
        </div>
        {sorted.map((s, i) => {
          const prev = prevFor.get(s.id)
          if (!s.isWarmup) workingNo++
          return (
            <div key={s.id} className={`set-row ${s.done && mode === 'live' ? 'set-done' : ''} ${needReps === s.id ? 'shake' : ''}`}>
              <button className={`set-no ${s.isWarmup ? 'set-warmup' : ''}`} onClick={() => setSetMenuFor(s)} aria-label={`Satz ${i + 1} Optionen`}>
                {s.isWarmup ? 'A' : workingNo}
              </button>
              {mode === 'live' && <span className="set-prev">{prev ? fmtSetShort(prev.weight, prev.reps) : '–'}</span>}
              <NumberField label="Gewicht in kg" decimal value={s.weight} placeholder={prev?.weight != null ? fmtWeight(prev.weight) : 'kg'} onCommit={(v) => commit(s, { weight: v })} />
              <NumberField label="Wiederholungen" decimal={false} value={s.reps} placeholder={prev?.reps != null ? String(prev.reps) : 'Wdh.'} onCommit={(v) => commit(s, { reps: v })} />
              {mode === 'live' && (
                <button className={`check ${s.done ? 'check-on' : ''}`} onClick={() => toggle(s)} aria-label={s.done ? 'Satz als offen markieren' : 'Satz abhaken'} aria-pressed={s.done}>
                  <Icon name="check" size={22} strokeWidth={3} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn btn-ghost btn-block btn-small" onClick={() => exerciseId !== undefined && addSet(workoutId, exerciseId, exerciseOrder)}>
        <Icon name="plus" size={18} /> Satz
      </button>

      {menu && (
        <Dialog
          title={exercise?.name ?? 'Übung'}
          onClose={() => setMenu(false)}
          actions={[
            { label: exercise?.notes ? 'Notiz bearbeiten' : 'Notiz hinzufügen', onClick: () => (setMenu(false), setNoteEdit(exercise?.notes ?? '')) },
            ...(!isFirst ? [{ label: 'Nach oben', onClick: () => (setMenu(false), moveExerciseInWorkout(workoutId, exerciseOrder, -1)) }] : []),
            ...(!isLast ? [{ label: 'Nach unten', onClick: () => (setMenu(false), moveExerciseInWorkout(workoutId, exerciseOrder, 1)) }] : []),
            { label: 'Übung entfernen', kind: 'danger' as const, onClick: () => (setMenu(false), removeExerciseFromWorkout(workoutId, exerciseOrder)) },
          ]}
        />
      )}

      {setMenuFor && (
        <Dialog
          title="Satz"
          onClose={() => setSetMenuFor(null)}
          actions={[
            {
              label: setMenuFor.isWarmup ? 'Als Arbeitssatz markieren' : 'Als Aufwärmsatz markieren',
              onClick: () => (db.sets.update(setMenuFor.id, { isWarmup: !setMenuFor.isWarmup }), setSetMenuFor(null)),
            },
            { label: 'Satz löschen', kind: 'danger', onClick: () => (removeSet(setMenuFor.id), setSetMenuFor(null)) },
          ]}
        />
      )}

      {noteEdit !== null && exercise && (
        <Dialog
          title="Notiz zur Übung"
          onClose={() => setNoteEdit(null)}
          actions={[{ label: 'Speichern', kind: 'primary', onClick: () => (db.exercises.update(exercise.id, { notes: noteEdit.trim() }), setNoteEdit(null)) }]}
        >
          <textarea className="input textarea" rows={3} value={noteEdit} onChange={(e) => setNoteEdit(e.target.value)} placeholder="z. B. Sitz auf Stufe 4, enger Griff" autoFocus />
          <p className="muted small">Die Notiz erscheint bei jedem Training mit dieser Übung.</p>
        </Dialog>
      )}
    </section>
  )
}

/** Sätze nach Übungsposition gruppieren. */
export function groupSets(sets: WorkoutSet[]): [number, WorkoutSet[]][] {
  const m = new Map<number, WorkoutSet[]>()
  for (const s of sets) m.set(s.exerciseOrder, [...(m.get(s.exerciseOrder) ?? []), s])
  return [...m.entries()].sort((a, b) => a[0] - b[0])
}

/**
 * Ordnet jedem Satz den passenden Satz vom letzten Mal zu:
 * Aufwärmsätze zu Aufwärmsätzen, Arbeitssätze zu Arbeitssätzen (jeweils der Reihe nach).
 */
export function matchPrevious(current: WorkoutSet[], previous: WorkoutSet[]): Map<number, WorkoutSet> {
  const warm = previous.filter((s) => s.isWarmup)
  const work = previous.filter((s) => !s.isWarmup)
  const m = new Map<number, WorkoutSet>()
  let w = 0
  let k = 0
  for (const s of current) {
    const p = s.isWarmup ? warm[w++] : work[k++]
    if (p) m.set(s.id, p)
  }
  return m
}
