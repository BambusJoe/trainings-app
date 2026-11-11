import Dexie, { type EntityTable } from 'dexie'
import { findPoolEntry } from './data/exercisePool'

export interface Exercise {
  id: number
  name: string
  notes: string
  /** Muskelgruppe (aus dem Pool oder selbst gesetzt) */
  muscle?: string
  createdAt: number
}

/** Sollwerte eines Arbeitssatzes in der Routine (leer = kein Sollwert) */
export interface RoutineSet {
  weight: number | null
  reps: number | null
}

export interface RoutineItem {
  exerciseId: number
  sets: RoutineSet[]
  restSeconds: number
}

export interface Routine {
  id: number
  name: string
  sortOrder: number
  items: RoutineItem[]
}

export interface Workout {
  id: number
  routineId?: number
  name: string
  startedAt: number
  /** undefined = Training läuft noch */
  finishedAt?: number
  notes: string
  source: 'app' | 'hevy'
}

export interface WorkoutSet {
  id: number
  workoutId: number
  exerciseId: number
  /** Position der Übung im Training */
  exerciseOrder: number
  /** Position des Satzes innerhalb der Übung */
  setIndex: number
  weight: number | null
  reps: number | null
  isWarmup: boolean
  done: boolean
}

export interface Setting {
  key: string
  value: unknown
}

export class TrainingDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  sets!: EntityTable<WorkoutSet, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'trainingstagebuch') {
    super(name)
    this.version(1).stores({
      exercises: '++id, &name',
      routines: '++id, sortOrder',
      workouts: '++id, startedAt, finishedAt, routineId',
      sets: '++id, workoutId, exerciseId, [exerciseId+workoutId]',
      settings: 'key',
    })
    // v2: Routinen speichern Gewicht/Wdh. pro Satz statt nur der Satzanzahl
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('routines')
          .toCollection()
          .modify((r: { items: unknown[] }) => {
            r.items = (r.items ?? []).map(normalizeRoutineItem)
          }),
      )
  }
}

/** Wandelt alte Routine-Einträge (`sets` als Anzahl) in das aktuelle Format um. */
export function normalizeRoutineItem(raw: unknown): RoutineItem {
  const it = raw as { exerciseId: number; sets: unknown; restSeconds?: number }
  const sets: RoutineSet[] = Array.isArray(it.sets)
    ? it.sets.map((s: Partial<RoutineSet> | undefined) => ({ weight: s?.weight ?? null, reps: s?.reps ?? null }))
    : Array.from({ length: Math.max(1, Number(it.sets) || 3) }, () => ({ weight: null, reps: null }))
  return { exerciseId: it.exerciseId, sets, restSeconds: it.restSeconds ?? DEFAULT_REST_SECONDS }
}

export const db = new TrainingDB()

export const DEFAULT_REST_SECONDS = 90

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

/**
 * Übung per Name finden oder anlegen (Groß-/Kleinschreibung egal).
 * Englische Namen aus dem Pool (z. B. von Hevy) werden auf den deutschen Pool-Namen abgebildet.
 */
export async function getOrCreateExercise(name: string, database: TrainingDB = db): Promise<number> {
  const clean = name.trim()
  const pool = findPoolEntry(clean)
  const candidates = [clean.toLowerCase(), ...(pool ? [pool.name.toLowerCase()] : [])]
  const existing = await database.exercises.filter((e) => candidates.includes(e.name.toLowerCase())).first()
  if (existing) return existing.id
  return (await database.exercises.add({
    name: pool?.name ?? clean,
    notes: '',
    muscle: pool?.muscle,
    createdAt: Date.now(),
  } as Exercise)) as number
}
