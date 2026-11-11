import { db as defaultDb, type Routine, type TrainingDB, type Workout, type WorkoutSet, type RoutineItem, type RoutineSet, DEFAULT_REST_SECONDS } from '../db'
import { lastPerformance } from './stats'

export const DEFAULT_SET_COUNT = 3

export async function getActiveWorkout(database: TrainingDB = defaultDb): Promise<Workout | undefined> {
  return database.workouts.filter((w) => w.finishedAt === undefined).first()
}

function emptySet(workoutId: number, exerciseId: number, exerciseOrder: number, setIndex: number, isWarmup = false) {
  return { workoutId, exerciseId, exerciseOrder, setIndex, weight: null, reps: null, isWarmup, done: false } as Omit<WorkoutSet, 'id'>
}

/**
 * Startet ein Training – leer oder aus einer Routine. Arbeitssätze werden mit den Sollwerten der Routine vorbelegt;
 * Felder ohne Sollwert zeigen die Werte vom letzten Mal als Vorschlag.
 */
export async function startWorkout(routine?: Routine, database: TrainingDB = defaultDb): Promise<number> {
  const active = await getActiveWorkout(database)
  if (active) return active.id
  return database.transaction('rw', database.workouts, database.sets, async () => {
    const workoutId = (await database.workouts.add({
      routineId: routine?.id,
      name: routine?.name ?? 'Freies Training',
      startedAt: Date.now(),
      notes: '',
      source: 'app',
    } as Workout)) as number
    if (routine) {
      const rows: Omit<WorkoutSet, 'id'>[] = []
      for (const [order, item] of routine.items.entries()) {
        // Aufwärmsätze vom letzten Mal (Werte als Vorschlag), danach die Arbeitssätze mit den Sollwerten der Routine
        const last = await lastPerformance(item.exerciseId, workoutId, database)
        const warmups = last?.sets.filter((s) => s.isWarmup).length ?? 0
        let idx = 0
        for (let i = 0; i < warmups; i++) rows.push(emptySet(workoutId, item.exerciseId, order, idx++, true))
        for (const target of item.sets) {
          rows.push({ ...emptySet(workoutId, item.exerciseId, order, idx++), weight: target.weight, reps: target.reps })
        }
      }
      await database.sets.bulkAdd(rows as WorkoutSet[])
    }
    return workoutId
  })
}

export async function addExerciseToWorkout(workoutId: number, exerciseId: number, database: TrainingDB = defaultDb) {
  const sets = await database.sets.where('workoutId').equals(workoutId).toArray()
  const order = sets.length ? Math.max(...sets.map((s) => s.exerciseOrder)) + 1 : 0
  const last = await lastPerformance(exerciseId, workoutId, database)
  const count = last?.sets.length || DEFAULT_SET_COUNT
  const rows = Array.from({ length: count }, (_, i) => emptySet(workoutId, exerciseId, order, i, last?.sets[i]?.isWarmup ?? false))
  await database.sets.bulkAdd(rows as WorkoutSet[])
}

export async function addSet(workoutId: number, exerciseId: number, exerciseOrder: number, database: TrainingDB = defaultDb) {
  const sets = await database.sets.where('workoutId').equals(workoutId).filter((s) => s.exerciseOrder === exerciseOrder).toArray()
  const nextIndex = sets.length ? Math.max(...sets.map((s) => s.setIndex)) + 1 : 0
  await database.sets.add(emptySet(workoutId, exerciseId, exerciseOrder, nextIndex) as WorkoutSet)
}

/** Löscht einen Satz und nummeriert die übrigen Sätze der Übung neu. */
export async function removeSet(setId: number, database: TrainingDB = defaultDb) {
  await database.transaction('rw', database.sets, async () => {
    const s = await database.sets.get(setId)
    if (!s) return
    await database.sets.delete(setId)
    const rest = (await database.sets.where('workoutId').equals(s.workoutId).filter((x) => x.exerciseOrder === s.exerciseOrder).toArray()).sort(
      (a, b) => a.setIndex - b.setIndex,
    )
    await Promise.all(rest.map((x, i) => (x.setIndex === i ? null : database.sets.update(x.id, { setIndex: i }))))
  })
}

export async function removeExerciseFromWorkout(workoutId: number, exerciseOrder: number, database: TrainingDB = defaultDb) {
  await database.transaction('rw', database.sets, async () => {
    const sets = await database.sets.where('workoutId').equals(workoutId).toArray()
    await database.sets.bulkDelete(sets.filter((s) => s.exerciseOrder === exerciseOrder).map((s) => s.id))
    const later = sets.filter((s) => s.exerciseOrder > exerciseOrder)
    await Promise.all(later.map((s) => database.sets.update(s.id, { exerciseOrder: s.exerciseOrder - 1 })))
  })
}

/** Tauscht die Position einer Übung mit der vorherigen/nächsten. */
export async function moveExerciseInWorkout(workoutId: number, exerciseOrder: number, delta: -1 | 1, database: TrainingDB = defaultDb) {
  await database.transaction('rw', database.sets, async () => {
    const sets = await database.sets.where('workoutId').equals(workoutId).toArray()
    const target = exerciseOrder + delta
    if (target < 0 || !sets.some((s) => s.exerciseOrder === target)) return
    await Promise.all(
      sets.map((s) =>
        s.exerciseOrder === exerciseOrder
          ? database.sets.update(s.id, { exerciseOrder: target })
          : s.exerciseOrder === target
            ? database.sets.update(s.id, { exerciseOrder })
            : null,
      ),
    )
  })
}

/** Übungsreihenfolge + Arbeitssätze (Gewicht/Wdh.) eines Trainings als Routine-Items. */
export function routineItemsFromSets(sets: WorkoutSet[], previous: RoutineItem[] = []): RoutineItem[] {
  const groups = new Map<number, WorkoutSet[]>()
  for (const s of sets) groups.set(s.exerciseOrder, [...(groups.get(s.exerciseOrder) ?? []), s])
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, g]) => {
      const exerciseId = g[0].exerciseId
      const prev = previous.find((p) => p.exerciseId === exerciseId)
      const working = g.filter((s) => !s.isWarmup).sort((a, b) => a.setIndex - b.setIndex)
      const routineSets: RoutineSet[] = working.length ? working.map((s) => ({ weight: s.weight, reps: s.reps })) : [{ weight: null, reps: null }]
      return { exerciseId, sets: routineSets, restSeconds: prev?.restSeconds ?? DEFAULT_REST_SECONDS }
    })
}

/**
 * Neue Routine-Items nach einem Training: gemachte Übungen bekommen die heutigen Sätze,
 * übersprungene Übungen bleiben unverändert, neu hinzugekommene werden angehängt.
 */
export function mergeRoutineWithWorkout(routine: Routine, doneSets: WorkoutSet[]): RoutineItem[] {
  const fromWorkout = routineItemsFromSets(doneSets, routine.items)
  const byExercise = new Map(fromWorkout.map((it) => [it.exerciseId, it]))
  const kept = routine.items.map((it) => byExercise.get(it.exerciseId) ?? it)
  const added = fromWorkout.filter((it) => !routine.items.some((r) => r.exerciseId === it.exerciseId))
  return [...kept, ...added]
}

/** Würde das Training die Routine verändern (Sätze, Gewicht, Wdh. oder neue Übungen)? */
export function differsFromRoutine(doneSets: WorkoutSet[], routine: Routine): boolean {
  const items = mergeRoutineWithWorkout(routine, doneSets)
  if (items.length !== routine.items.length) return true
  return items.some((it, i) => {
    const r = routine.items[i]
    return (
      it.exerciseId !== r.exerciseId ||
      it.sets.length !== r.sets.length ||
      it.sets.some((s, j) => s.weight !== r.sets[j].weight || s.reps !== r.sets[j].reps)
    )
  })
}

/** Vorschlag für eine neue Übung in einer Routine: Arbeitssätze vom letzten Mal, sonst 3 leere Sätze. */
export async function suggestRoutineSets(exerciseId: number, database: TrainingDB = defaultDb): Promise<RoutineSet[]> {
  const last = await lastPerformance(exerciseId, undefined, database)
  const working = last?.sets.filter((s) => !s.isWarmup) ?? []
  if (working.length) return working.map((s) => ({ weight: s.weight, reps: s.reps }))
  return Array.from({ length: DEFAULT_SET_COUNT }, () => ({ weight: null, reps: null }))
}

/**
 * Beendet das Training: nicht abgehakte Sätze werden verworfen.
 * Mit `updateRoutine` wird die Routine an den tatsächlichen Ablauf angepasst.
 */
export async function finishWorkout(workoutId: number, opts: { updateRoutine?: boolean } = {}, database: TrainingDB = defaultDb) {
  await database.transaction('rw', database.workouts, database.sets, database.routines, async () => {
    const workout = await database.workouts.get(workoutId)
    if (!workout) return
    const sets = await database.sets.where('workoutId').equals(workoutId).toArray()
    const done = sets.filter((s) => s.done)
    await database.sets.bulkDelete(sets.filter((s) => !s.done).map((s) => s.id))

    // Reihenfolge lückenlos machen und Sätze neu nummerieren
    const orders = [...new Set(done.map((s) => s.exerciseOrder))].sort((a, b) => a - b)
    for (const [newOrder, oldOrder] of orders.entries()) {
      const group = done.filter((s) => s.exerciseOrder === oldOrder).sort((a, b) => a.setIndex - b.setIndex)
      for (const [i, s] of group.entries()) {
        if (s.exerciseOrder !== newOrder || s.setIndex !== i) await database.sets.update(s.id, { exerciseOrder: newOrder, setIndex: i })
        s.exerciseOrder = newOrder
        s.setIndex = i
      }
    }

    if (opts.updateRoutine && workout.routineId !== undefined) {
      const routine = await database.routines.get(workout.routineId)
      if (routine) await database.routines.update(routine.id, { items: mergeRoutineWithWorkout(routine, done) })
    }
    await database.workouts.update(workoutId, { finishedAt: Date.now() })
  })
}

export async function deleteWorkout(workoutId: number, database: TrainingDB = defaultDb) {
  await database.transaction('rw', database.workouts, database.sets, async () => {
    await database.sets.where('workoutId').equals(workoutId).delete()
    await database.workouts.delete(workoutId)
  })
}
