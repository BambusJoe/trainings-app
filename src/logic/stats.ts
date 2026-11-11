import { db as defaultDb, type TrainingDB, type WorkoutSet, type Workout } from '../db'

/** Geschätztes 1RM nach Epley. */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Ein Satz zählt, wenn er abgehakt ist und Wiederholungen hat. */
export function isCountedSet(s: WorkoutSet): boolean {
  return s.done && (s.reps ?? 0) > 0
}

export interface LastPerformance {
  workout: Workout
  sets: WorkoutSet[]
}

/**
 * Sätze des letzten abgeschlossenen Trainings, in dem die Übung vorkam.
 * `excludeWorkoutId` = das gerade laufende Training.
 */
export async function lastPerformance(
  exerciseId: number,
  excludeWorkoutId?: number,
  database: TrainingDB = defaultDb,
): Promise<LastPerformance | null> {
  const sets = await database.sets.where('exerciseId').equals(exerciseId).toArray()
  const workoutIds = [...new Set(sets.map((s) => s.workoutId))].filter((id) => id !== excludeWorkoutId)
  if (workoutIds.length === 0) return null
  const workouts = (await database.workouts.bulkGet(workoutIds)).filter(
    (w): w is Workout => !!w && w.finishedAt !== undefined,
  )
  // nur Trainings, in denen tatsächlich ein Satz gemacht wurde
  const withDone = workouts.filter((w) => sets.some((s) => s.workoutId === w.id && isCountedSet(s)))
  if (withDone.length === 0) return null
  withDone.sort((a, b) => b.startedAt - a.startedAt)
  const workout = withDone[0]
  return {
    workout,
    sets: sets
      .filter((s) => s.workoutId === workout.id && isCountedSet(s))
      .sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.setIndex - b.setIndex),
  }
}

export interface SessionStats {
  workoutId: number
  date: number
  bestWeight: number
  best1RM: number
  volume: number
  sets: WorkoutSet[]
}

export interface Records {
  heaviest: { weight: number; reps: number; date: number } | null
  best1RM: { value: number; weight: number; reps: number; date: number } | null
  mostReps: { weight: number; reps: number; date: number } | null
  bestVolume: { volume: number; date: number } | null
}

/** Verlauf einer Übung über alle abgeschlossenen Trainings (alt → neu). Aufwärmsätze zählen nicht. */
export async function exerciseHistory(
  exerciseId: number,
  database: TrainingDB = defaultDb,
): Promise<SessionStats[]> {
  const sets = (await database.sets.where('exerciseId').equals(exerciseId).toArray()).filter(
    (s) => isCountedSet(s) && !s.isWarmup,
  )
  const byWorkout = new Map<number, WorkoutSet[]>()
  for (const s of sets) {
    const list = byWorkout.get(s.workoutId) ?? []
    list.push(s)
    byWorkout.set(s.workoutId, list)
  }
  const workouts = (await database.workouts.bulkGet([...byWorkout.keys()])).filter(
    (w): w is Workout => !!w && w.finishedAt !== undefined,
  )
  return workouts
    .map((w) => {
      const ws = byWorkout.get(w.id)!.sort((a, b) => a.setIndex - b.setIndex)
      return {
        workoutId: w.id,
        date: w.startedAt,
        bestWeight: Math.max(...ws.map((s) => s.weight ?? 0)),
        best1RM: round1(Math.max(...ws.map((s) => epley1RM(s.weight ?? 0, s.reps ?? 0)))),
        volume: ws.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0),
        sets: ws,
      }
    })
    .sort((a, b) => a.date - b.date)
}

export function computeRecords(history: SessionStats[]): Records {
  const r: Records = { heaviest: null, best1RM: null, mostReps: null, bestVolume: null }
  for (const h of history) {
    for (const s of h.sets) {
      const w = s.weight ?? 0
      const reps = s.reps ?? 0
      if (!r.heaviest || w > r.heaviest.weight || (w === r.heaviest.weight && reps > r.heaviest.reps)) {
        r.heaviest = { weight: w, reps, date: h.date }
      }
      const e = round1(epley1RM(w, reps))
      if (!r.best1RM || e > r.best1RM.value) r.best1RM = { value: e, weight: w, reps, date: h.date }
      if (!r.mostReps || reps > r.mostReps.reps || (reps === r.mostReps.reps && w > r.mostReps.weight)) {
        r.mostReps = { weight: w, reps, date: h.date }
      }
    }
    if (!r.bestVolume || h.volume > r.bestVolume.volume) r.bestVolume = { volume: h.volume, date: h.date }
  }
  return r
}

/** Gesamtvolumen (kg × Wdh.) eines Trainings ohne Aufwärmsätze. */
export function workoutVolume(sets: WorkoutSet[]): number {
  return sets.filter((s) => isCountedSet(s) && !s.isWarmup).reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)
}
