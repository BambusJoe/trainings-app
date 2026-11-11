import { db as defaultDb, normalizeRoutineItem, type TrainingDB } from '../db'

export const BACKUP_APP_ID = 'trainingstagebuch'
export const BACKUP_VERSION = 2

export interface Backup {
  app: typeof BACKUP_APP_ID
  version: number
  exportedAt: string
  data: {
    exercises: unknown[]
    routines: unknown[]
    workouts: unknown[]
    sets: unknown[]
    settings: unknown[]
  }
}

const TABLES = ['exercises', 'routines', 'workouts', 'sets', 'settings'] as const

export async function createBackup(database: TrainingDB = defaultDb): Promise<Backup> {
  const [exercises, routines, workouts, sets, settings] = await Promise.all(TABLES.map((t) => database.table(t).toArray()))
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { exercises, routines, workouts, sets, settings },
  }
}

export function validateBackup(value: unknown): Backup {
  const b = value as Backup
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP_ID || typeof b.data !== 'object' || b.data === null) {
    throw new Error('Diese Datei ist kein Backup des Trainingstagebuchs.')
  }
  if (b.version > BACKUP_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren App-Version.')
  }
  for (const t of TABLES) {
    if (!Array.isArray(b.data[t])) throw new Error(`Backup unvollständig: „${t}“ fehlt.`)
  }
  return b
}

/** Ersetzt ALLE Daten durch den Inhalt des Backups. */
export async function restoreBackup(value: unknown, database: TrainingDB = defaultDb): Promise<void> {
  const b = validateBackup(value)
  const tables = TABLES.map((t) => database.table(t))
  await database.transaction('rw', tables, async () => {
    for (const t of TABLES) {
      await database.table(t).clear()
      const rows =
        t === 'routines' ? (b.data.routines as { items?: unknown[] }[]).map((r) => ({ ...r, items: (r.items ?? []).map(normalizeRoutineItem) })) : b.data[t]
      await database.table(t).bulkAdd(rows)
    }
  })
}

export function backupFileName(date = new Date()): string {
  const d = date.toISOString().slice(0, 10)
  return `training-backup-${d}.json`
}
