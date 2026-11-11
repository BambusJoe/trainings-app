import { db as defaultDb, DEFAULT_REST_SECONDS, type Routine, type RoutineItem, type TrainingDB, type Workout } from '../db'
import { routineItemsFromSets } from './workout'

export interface RoutineCandidate {
  /** Name des Trainings (in Hevy = Name der Routine) */
  name: string
  /** Wie oft ein Training mit diesem Namen gemacht wurde */
  count: number
  /** Datum des letzten Trainings – daraus stammen Übungen und Sollwerte */
  lastDate: number
  items: RoutineItem[]
  /** Es gibt schon eine Routine mit diesem Namen */
  exists: boolean
}

const key = (name: string) => name.trim().toLowerCase()

/**
 * Leitet aus dem Tagebuch Routinen ab: Trainings werden nach Namen gruppiert,
 * Übungen, Reihenfolge und Arbeitssätze (Gewicht/Wdh.) kommen aus dem jeweils letzten Training.
 */
export async function routineCandidates(restSeconds = DEFAULT_REST_SECONDS, database: TrainingDB = defaultDb): Promise<RoutineCandidate[]> {
  const workouts = (await database.workouts.toArray()).filter((w) => w.finishedAt !== undefined && w.name.trim())
  const existing = new Set((await database.routines.toArray()).map((r) => key(r.name)))

  const groups = new Map<string, Workout[]>()
  for (const w of workouts) groups.set(key(w.name), [...(groups.get(key(w.name)) ?? []), w])

  const result: RoutineCandidate[] = []
  for (const list of groups.values()) {
    list.sort((a, b) => b.startedAt - a.startedAt)
    const latest = list[0]
    const sets = (await database.sets.where('workoutId').equals(latest.id).toArray()).filter((s) => s.done)
    const items = routineItemsFromSets(sets).map((it) => ({ ...it, restSeconds }))
    if (items.length === 0) continue
    result.push({ name: latest.name.trim(), count: list.length, lastDate: latest.startedAt, items, exists: existing.has(key(latest.name)) })
  }
  // häufig gemachte Trainings zuerst, bei Gleichstand das zuletzt gemachte
  return result.sort((a, b) => b.count - a.count || b.lastDate - a.lastDate)
}

/** Legt die gewählten Routinen an (hinten an die bestehenden). Vorhandene Namen werden übersprungen. */
export async function createRoutines(candidates: RoutineCandidate[], database: TrainingDB = defaultDb): Promise<number> {
  return database.transaction('rw', database.routines, async () => {
    const existing = new Set((await database.routines.toArray()).map((r) => key(r.name)))
    let order = ((await database.routines.orderBy('sortOrder').last())?.sortOrder ?? -1) + 1
    let created = 0
    for (const c of candidates) {
      if (existing.has(key(c.name))) continue
      existing.add(key(c.name))
      await database.routines.add({ name: c.name, sortOrder: order++, items: c.items } as Routine)
      created++
    }
    return created
  })
}
