import { describe, it, expect, beforeEach } from 'vitest'
import { TrainingDB, getOrCreateExercise, type Routine, type WorkoutSet } from '../db'
import { epley1RM, lastPerformance, exerciseHistory, computeRecords } from './stats'
import { parseHevyCsv, parseHevyDate, importHevyWorkouts } from './hevy'
import { createBackup, restoreBackup } from './backup'
import { EXERCISE_POOL, findPoolEntry, matchesQuery } from '../data/exercisePool'
import { routineCandidates, createRoutines } from './routinesFromHistory'
import { startWorkout, finishWorkout, addExerciseToWorkout, getActiveWorkout, differsFromRoutine, removeSet, suggestRoutineSets } from './workout'

let n = 0
let db: TrainingDB
beforeEach(() => {
  db = new TrainingDB(`test-${n++}`)
})

const HEVY_CSV = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push","15 Mar 2024, 18:03","15 Mar 2024, 19:10","Guter Tag","Bench Press (Barbell)",,"Griff eng","0","warmup","40","10",,,
"Push","15 Mar 2024, 18:03","15 Mar 2024, 19:10","Guter Tag","Bench Press (Barbell)",,"Griff eng","1","normal","80","8",,,
"Push","15 Mar 2024, 18:03","15 Mar 2024, 19:10","Guter Tag","Bench Press (Barbell)",,"Griff eng","2","normal","80","7",,,
"Push","15 Mar 2024, 18:03","15 Mar 2024, 19:10","Guter Tag","Plank",,,"0","normal",,,,"60",
"Push","15 Mar 2024, 18:03","15 Mar 2024, 19:10","Guter Tag","Dips",,,"0","normal",,"12",,,
"Push","22 Mar 2024, 18:00","22 Mar 2024, 19:00",,"Bench Press (Barbell)",,,"0","normal","82.5","6",,,
`

describe('Hevy-Import', () => {
  it('liest Datumsformate', () => {
    expect(new Date(parseHevyDate('15 Mar 2024, 18:03')!).toISOString().slice(0, 10)).toBe(
      new Date(2024, 2, 15, 18, 3).toISOString().slice(0, 10),
    )
    expect(parseHevyDate('3 Dez 2025, 07:15')).toBe(new Date(2025, 11, 3, 7, 15).getTime())
    expect(parseHevyDate('2024-03-15T18:03:00Z')).toBe(Date.parse('2024-03-15T18:03:00Z'))
    expect(parseHevyDate('kaputt')).toBeNull()
    // weitere Formate, die Hevy je nach Version/Sprache exportiert (Safari kann einige davon nicht selbst lesen)
    const t = new Date(2025, 2, 15, 18, 3).getTime()
    expect(parseHevyDate('15. März 2025, 18:03')).toBe(t)
    expect(parseHevyDate('Mar 15, 2025, 6:03 PM')).toBe(t)
    expect(parseHevyDate('15 Mar 2025, 6:03\u202fPM')).toBe(t)
    expect(parseHevyDate('2025-03-15 18:03:00')).toBe(t)
    expect(parseHevyDate('15.03.2025 18:03')).toBe(t)
    expect(parseHevyDate('Mar 15, 2025, 12:10 AM')).toBe(new Date(2025, 2, 15, 0, 10).getTime())
  })

  it('gruppiert Trainings und Übungen, überspringt Zeitübungen', () => {
    const r = parseHevyCsv(HEVY_CSV)
    expect(r.skippedRows).toBe(1)
    expect(r.workouts).toHaveLength(2)
    const [push] = r.workouts
    expect(push.notes).toBe('Guter Tag')
    expect(push.exercises.map((e) => e.name)).toEqual(['Bench Press (Barbell)', 'Dips']) // Parser lässt Namen unverändert
    expect(push.exercises[0].sets).toEqual([
      { weight: 40, reps: 10, isWarmup: true },
      { weight: 80, reps: 8, isWarmup: false },
      { weight: 80, reps: 7, isWarmup: false },
    ])
    expect(push.exercises[1].sets[0].weight).toBeNull()
  })

  it('lehnt fremde CSV ab', () => {
    expect(() => parseHevyCsv('a,b\n1,2')).toThrow(/Hevy/)
  })

  it('importiert und erkennt Duplikate', async () => {
    const parsed = parseHevyCsv(HEVY_CSV).workouts
    const first = await importHevyWorkouts(parsed, db)
    expect(first).toEqual({ workoutsAdded: 2, duplicatesSkipped: 0, exercisesCreated: 2, setsAdded: 5 })
    const again = await importHevyWorkouts(parsed, db)
    expect(again.workoutsAdded).toBe(0)
    expect(again.duplicatesSkipped).toBe(2)
    const bench = await db.exercises.where('name').equals('Bankdrücken (Langhantel)').first()
    expect(bench?.notes).toBe('Griff eng')
  })
})

describe('Übungs-Pool', () => {
  it('bildet englische Hevy-Namen auf deutsche Pool-Übungen ab', async () => {
    const a = await getOrCreateExercise('Bench Press (Barbell)', db)
    const b = await getOrCreateExercise('bankdrücken (langhantel)', db)
    expect(a).toBe(b)
    expect(await db.exercises.get(a)).toMatchObject({ name: 'Bankdrücken (Langhantel)', muscle: 'Brust' })
    const own = await getOrCreateExercise('Meine Spezialübung', db)
    expect((await db.exercises.get(own))?.muscle).toBeUndefined()
  })

  it('sucht mit mehreren Wörtern, ohne Umlaute und auf Englisch', () => {
    expect(matchesQuery('bank kurz', 'Bankdrücken (Kurzhantel)')).toBe(true)
    expect(matchesQuery('bankdruecken', 'Bankdrücken (Kurzhantel)')).toBe(true)
    expect(matchesQuery('bench', 'Bankdrücken (Langhantel)', findPoolEntry('Bankdrücken (Langhantel)')!.aliases)).toBe(true)
    expect(matchesQuery('kniebeuge', 'Bankdrücken (Langhantel)')).toBe(false)
  })

  it('hat keine doppelten Namen', () => {
    const names = EXERCISE_POOL.map((p) => p.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('Letztes Mal & Statistik', () => {
  it('liefert die Sätze des letzten abgeschlossenen Trainings', async () => {
    await importHevyWorkouts(parseHevyCsv(HEVY_CSV).workouts, db)
    const bench = (await db.exercises.where('name').equals('Bankdrücken (Langhantel)').first())!
    const last = await lastPerformance(bench.id, undefined, db)
    expect(last?.workout.startedAt).toBe(new Date(2024, 2, 22, 18, 0).getTime())
    expect(last?.sets.map((s) => [s.weight, s.reps])).toEqual([[82.5, 6]])

    // Ein laufendes Training zählt nicht als "letztes Mal"
    const wid = await startWorkout(undefined, db)
    await addExerciseToWorkout(wid, bench.id, db)
    const sets = await db.sets.where('workoutId').equals(wid).toArray()
    expect(sets).toHaveLength(1) // so viele Sätze wie letztes Mal
    await db.sets.update(sets[0].id, { weight: 100, reps: 5, done: true })
    expect((await lastPerformance(bench.id, wid, db))?.sets[0].weight).toBe(82.5)
    expect((await lastPerformance(bench.id, undefined, db))?.sets[0].weight).toBe(82.5)

    await finishWorkout(wid, {}, db)
    expect((await lastPerformance(bench.id, undefined, db))?.sets[0].weight).toBe(100)
  })

  it('berechnet 1RM, Verlauf und Rekorde ohne Aufwärmsätze', async () => {
    expect(epley1RM(100, 1)).toBe(100)
    expect(epley1RM(80, 8)).toBeCloseTo(101.33, 1)
    await importHevyWorkouts(parseHevyCsv(HEVY_CSV).workouts, db)
    const bench = (await db.exercises.where('name').equals('Bankdrücken (Langhantel)').first())!
    const h = await exerciseHistory(bench.id, db)
    expect(h.map((x) => x.bestWeight)).toEqual([80, 82.5])
    expect(h[0].volume).toBe(80 * 8 + 80 * 7)
    const r = computeRecords(h)
    expect(r.heaviest?.weight).toBe(82.5)
    expect(r.best1RM?.value).toBe(101.3)
    expect(r.mostReps).toMatchObject({ reps: 8, weight: 80 })
  })
})

describe('Trainingsablauf', () => {
  it('startet aus Routine, verwirft offene Sätze und passt Routine an', async () => {
    const a = await getOrCreateExercise('Kniebeuge', db)
    const b = await getOrCreateExercise('Rudern', db)
    const target = (weight: number | null, reps: number | null) => ({ weight, reps })
    const rid = (await db.routines.add({
      name: 'Beine',
      sortOrder: 0,
      items: [
        { exerciseId: a, sets: [target(100, 5), target(100, 5), target(105, 3)], restSeconds: 120 },
        { exerciseId: b, sets: [target(null, null), target(null, null)], restSeconds: 90 },
      ],
    } as Omit<Routine, 'id'> as Routine)) as number
    const routine = (await db.routines.get(rid))!
    const wid = await startWorkout(routine, db)
    expect(await startWorkout(routine, db)).toBe(wid) // nur ein aktives Training
    expect((await getActiveWorkout(db))?.id).toBe(wid)

    let sets = await db.sets.where('workoutId').equals(wid).toArray()
    expect(sets).toHaveLength(5)
    // Arbeitssätze sind mit den Sollwerten der Routine vorbelegt
    expect(sets.filter((s) => s.exerciseId === a).sort((x, y) => x.setIndex - y.setIndex).map((s) => [s.weight, s.reps])).toEqual([[100, 5], [100, 5], [105, 3]])
    expect(sets.find((s) => s.exerciseId === b)?.weight).toBeNull()
    // Kniebeuge: 2 von 3 Sätzen gemacht, Rudern gar nicht
    const squat = sets.filter((s) => s.exerciseId === a).sort((x, y) => x.setIndex - y.setIndex)
    await db.sets.update(squat[0].id, { done: true })
    await db.sets.update(squat[2].id, { weight: 107.5, done: true })
    sets = await db.sets.where('workoutId').equals(wid).toArray()
    expect(differsFromRoutine(sets.filter((s: WorkoutSet) => s.done), routine)).toBe(true)

    await finishWorkout(wid, { updateRoutine: true }, db)
    const left = await db.sets.where('workoutId').equals(wid).toArray()
    expect(left.map((s) => s.setIndex).sort()).toEqual([0, 1])
    // Kniebeuge bekommt die heutigen Werte, das übersprungene Rudern bleibt unverändert in der Routine
    expect((await db.routines.get(rid))!.items).toEqual([
      { exerciseId: a, sets: [target(100, 5), target(107.5, 3)], restSeconds: 120 },
      { exerciseId: b, sets: [target(null, null), target(null, null)], restSeconds: 90 },
    ])
    expect(await getActiveWorkout(db)).toBeUndefined()
  })

  it('ergänzt Aufwärmsätze vom letzten Mal vor den Arbeitssätzen der Routine', async () => {
    await importHevyWorkouts(parseHevyCsv(HEVY_CSV).workouts.slice(0, 1), db) // Training mit 1 Aufwärm- + 2 Arbeitssätzen
    const bench = (await db.exercises.where('name').equals('Bankdrücken (Langhantel)').first())!
    // Vorschlag beim Einfügen in eine Routine = Arbeitssätze vom letzten Mal
    const suggested = await suggestRoutineSets(bench.id, db)
    expect(suggested).toEqual([{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }])
    expect(await suggestRoutineSets(await getOrCreateExercise('Nie gemacht', db), db)).toHaveLength(3)

    const rid = (await db.routines.add({ name: 'Push', sortOrder: 0, items: [{ exerciseId: bench.id, sets: [...suggested, { weight: 80, reps: 6 }], restSeconds: 90 }] } as Omit<Routine, 'id'> as Routine)) as number
    const routine = (await db.routines.get(rid))!
    const wid = await startWorkout(routine, db)
    const sets = (await db.sets.where('workoutId').equals(wid).toArray()).sort((a, b) => a.setIndex - b.setIndex)
    expect(sets.map((s) => s.isWarmup)).toEqual([true, false, false, false])
    expect(sets.map((s) => s.reps)).toEqual([null, 8, 7, 6])

    // Alles wie geplant gemacht → keine Abweichung von der Routine
    await Promise.all(sets.filter((s) => !s.isWarmup).map((s) => db.sets.update(s.id, { done: true })))
    const done = (await db.sets.where('workoutId').equals(wid).toArray()).filter((s) => s.done)
    expect(differsFromRoutine(done, routine)).toBe(false)
  })

  it('migriert alte Routinen (Satzanzahl) auf Sollwerte pro Satz', async () => {
    const name = `migration-${n++}`
    const { default: Dexie } = await import('dexie')
    const old = new Dexie(name)
    old.version(1).stores({ exercises: '++id, &name', routines: '++id, sortOrder', workouts: '++id, startedAt, finishedAt, routineId', sets: '++id, workoutId, exerciseId, [exerciseId+workoutId]', settings: 'key' })
    await old.table('routines').add({ name: 'Alt', sortOrder: 0, items: [{ exerciseId: 1, sets: 2, restSeconds: 60 }] })
    old.close()
    const migrated = new TrainingDB(name)
    expect((await migrated.routines.toArray())[0].items).toEqual([{ exerciseId: 1, sets: [{ weight: null, reps: null }, { weight: null, reps: null }], restSeconds: 60 }])
  })

  it('nummeriert Sätze nach dem Löschen neu', async () => {
    const a = await getOrCreateExercise('Curls', db)
    const wid = await startWorkout(undefined, db)
    await addExerciseToWorkout(wid, a, db)
    const sets = (await db.sets.where('workoutId').equals(wid).toArray()).sort((x, y) => x.setIndex - y.setIndex)
    await removeSet(sets[0].id, db)
    expect((await db.sets.where('workoutId').equals(wid).toArray()).map((s) => s.setIndex).sort()).toEqual([0, 1])
  })
})

describe('Routinen aus dem Verlauf', () => {
  it('gruppiert Trainings nach Namen und übernimmt das letzte Training als Vorlage', async () => {
    await importHevyWorkouts(parseHevyCsv(HEVY_CSV).workouts, db)
    const bench = (await db.exercises.where('name').equals('Bankdrücken (Langhantel)').first())!
    let cands = await routineCandidates(120, db)
    expect(cands).toHaveLength(1)
    expect(cands[0]).toMatchObject({ name: 'Push', count: 2, exists: false })
    // letztes "Push" (22. März): nur Bankdrücken, 1 Arbeitssatz
    expect(cands[0].items).toEqual([{ exerciseId: bench.id, sets: [{ weight: 82.5, reps: 6 }], restSeconds: 120 }])

    expect(await createRoutines(cands, db)).toBe(1)
    expect((await db.routines.toArray()).map((r) => r.name)).toEqual(['Push'])
    // zweites Mal: existiert schon → wird markiert und nicht doppelt angelegt
    cands = await routineCandidates(120, db)
    expect(cands[0].exists).toBe(true)
    expect(await createRoutines(cands, db)).toBe(0)
    expect(await db.routines.count()).toBe(1)
  })

  it('ignoriert laufende Trainings und Trainings ohne erledigte Sätze', async () => {
    const a = await getOrCreateExercise('Kniebeuge', db)
    const wid = await startWorkout(undefined, db)
    await addExerciseToWorkout(wid, a, db)
    expect(await routineCandidates(90, db)).toEqual([])
  })
})

describe('Backup', () => {
  it('Export und Import ergeben denselben Stand', async () => {
    await importHevyWorkouts(parseHevyCsv(HEVY_CSV).workouts, db)
    const backup = JSON.parse(JSON.stringify(await createBackup(db)))
    const other = new TrainingDB(`test-${n++}`)
    await getOrCreateExercise('wird überschrieben', other)
    await restoreBackup(backup, other)
    expect(await other.exercises.count()).toBe(2)
    expect(await other.sets.count()).toBe(5)
    expect(await other.workouts.count()).toBe(2)
    await expect(restoreBackup({ foo: 1 }, other)).rejects.toThrow(/kein Backup/)
  })
})
