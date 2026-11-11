import Papa from 'papaparse'
import { db as defaultDb, getOrCreateExercise, type TrainingDB, type Workout, type WorkoutSet } from '../db'

export interface ParsedSet {
  weight: number | null
  reps: number
  isWarmup: boolean
}

export interface ParsedExercise {
  name: string
  notes: string
  sets: ParsedSet[]
}

export interface ParsedWorkout {
  title: string
  startedAt: number
  finishedAt: number
  notes: string
  exercises: ParsedExercise[]
}

export interface ParseResult {
  workouts: ParsedWorkout[]
  /** Zeilen ohne Wiederholungen (z. B. Zeit-/Distanzübungen) oder mit unlesbarem Datum */
  skippedRows: number
  /** Erstes Datum, das nicht gelesen werden konnte (für die Fehlermeldung) */
  unreadableDate?: string
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, mär: 2, mrz: 2, apr: 3, may: 4, mai: 4, jun: 5, jul: 6,
  aug: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, dez: 11,
}

/** Stunde aus 12-Stunden-Format (AM/PM) in 24 Stunden umrechnen. */
function hour24(h: number, ampm: string | undefined): number {
  if (!ampm) return h
  const pm = ampm.toLowerCase().startsWith('p')
  if (h === 12) return pm ? 12 : 0
  return pm ? h + 12 : h
}

/**
 * Liest die Datumsformate, die Hevy (je nach Version/Sprache) exportiert, als lokale Zeit:
 * "15 Mar 2024, 18:03", "15. März 2024, 18:03", "Mar 15, 2024, 6:03 PM", "2024-03-15 18:03:00",
 * "15.03.2024 18:03" und ISO-Zeitstempel. Gibt null zurück, wenn nichts passt.
 * Wichtig: Safari kann "YYYY-MM-DD HH:MM" nicht mit Date.parse lesen – deshalb alles selbst parsen.
 */
export function parseHevyDate(value: string | undefined): number | null {
  if (!value) return null
  const v = value.trim().replace(/\u202f|\u00a0/g, ' ')
  const time = String.raw`,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?`
  const month = (name: string) => MONTHS[name.slice(0, 3).toLowerCase()]

  // 15 Mar 2024, 18:03  |  15. März 2024, 18:03
  let m = v.match(new RegExp(String.raw`^(\d{1,2})\.?\s+([A-Za-zÄäÖöÜü]{3,})\.?\s+(\d{4})` + time))
  if (m && month(m[2]) !== undefined) return new Date(+m[3], month(m[2]), +m[1], hour24(+m[4], m[7]), +m[5], +(m[6] ?? 0)).getTime()

  // Mar 15, 2024, 6:03 PM
  m = v.match(new RegExp(String.raw`^([A-Za-zÄäÖöÜü]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})` + time))
  if (m && month(m[1]) !== undefined) return new Date(+m[3], month(m[1]), +m[2], hour24(+m[4], m[7]), +m[5], +(m[6] ?? 0)).getTime()

  // 2024-03-15 18:03:00 (ohne Zeitzone = lokale Zeit)
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime()

  // 15.03.2024 18:03  |  15.03.2024, 18:03
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] ?? 0)).getTime()

  // ISO mit Zeitzone, z. B. 2024-03-15T18:03:00Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const iso = Date.parse(v)
    if (!Number.isNaN(iso)) return iso
  }
  return null
}

function num(value: string | undefined): number | null {
  if (value === undefined) return null
  const t = value.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const LBS_TO_KG = 0.45359237

export function parseHevyCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  const fields = parsed.meta.fields ?? []
  if (!fields.includes('exercise_title') || !fields.includes('start_time')) {
    const found = fields.slice(0, 6).join(', ') || 'keine'
    throw new Error(`Das sieht nicht nach einem Hevy-Export aus: Die Spalten „exercise_title“ und „start_time“ fehlen (gefunden: ${found}).`)
  }

  const workouts = new Map<string, ParsedWorkout>()
  let skippedRows = 0
  let unreadableDate: string | undefined

  for (const row of parsed.data) {
    const startedAt = parseHevyDate(row.start_time)
    const reps = num(row.reps)
    const name = row.exercise_title?.trim()
    if (startedAt === null && row.start_time && !unreadableDate) unreadableDate = row.start_time
    if (startedAt === null || !name || reps === null || reps <= 0) {
      skippedRows++
      continue
    }
    let weight = num(row.weight_kg)
    if (weight === null && row.weight_lbs !== undefined) {
      const lbs = num(row.weight_lbs)
      weight = lbs === null ? null : Math.round(lbs * LBS_TO_KG * 10) / 10
    }

    const title = row.title?.trim() || 'Training'
    const key = `${startedAt}|${title}`
    let w = workouts.get(key)
    if (!w) {
      w = {
        title,
        startedAt,
        finishedAt: parseHevyDate(row.end_time) ?? startedAt,
        notes: row.description?.trim() ?? '',
        exercises: [],
      }
      workouts.set(key, w)
    }
    // Neue Übung, wenn sich der Name vom vorherigen Block unterscheidet
    let ex = w.exercises[w.exercises.length - 1]
    if (!ex || ex.name !== name) {
      ex = w.exercises.find((e) => e.name === name) ?? { name, notes: row.exercise_notes?.trim() ?? '', sets: [] }
      if (!w.exercises.includes(ex)) w.exercises.push(ex)
    }
    ex.sets.push({ weight, reps, isWarmup: row.set_type?.trim().toLowerCase() === 'warmup' })
  }

  return {
    workouts: [...workouts.values()].sort((a, b) => a.startedAt - b.startedAt),
    skippedRows,
    unreadableDate,
  }
}

export interface ImportResult {
  workoutsAdded: number
  duplicatesSkipped: number
  exercisesCreated: number
  setsAdded: number
}

export async function importHevyWorkouts(
  parsed: ParsedWorkout[],
  database: TrainingDB = defaultDb,
): Promise<ImportResult> {
  const result: ImportResult = { workoutsAdded: 0, duplicatesSkipped: 0, exercisesCreated: 0, setsAdded: 0 }
  await database.transaction('rw', database.workouts, database.sets, database.exercises, async () => {
    const existing = await database.workouts.toArray()
    const keys = new Set(existing.map((w) => `${w.startedAt}|${w.name}`))
    const exerciseCountBefore = await database.exercises.count()

    for (const pw of parsed) {
      const key = `${pw.startedAt}|${pw.title}`
      if (keys.has(key)) {
        result.duplicatesSkipped++
        continue
      }
      keys.add(key)
      const workoutId = (await database.workouts.add({
        name: pw.title,
        startedAt: pw.startedAt,
        finishedAt: pw.finishedAt,
        notes: pw.notes,
        source: 'hevy',
      } as Workout)) as number

      const rows: Omit<WorkoutSet, 'id'>[] = []
      for (const [exerciseOrder, pe] of pw.exercises.entries()) {
        const exerciseId = await getOrCreateExercise(pe.name, database)
        if (pe.notes) {
          const ex = await database.exercises.get(exerciseId)
          if (ex && !ex.notes) await database.exercises.update(exerciseId, { notes: pe.notes })
        }
        pe.sets.forEach((s, setIndex) =>
          rows.push({ workoutId, exerciseId, exerciseOrder, setIndex, weight: s.weight, reps: s.reps, isWarmup: s.isWarmup, done: true }),
        )
      }
      await database.sets.bulkAdd(rows as WorkoutSet[])
      result.setsAdded += rows.length
      result.workoutsAdded++
    }
    result.exercisesCreated = (await database.exercises.count()) - exerciseCountBefore
  })
  return result
}
