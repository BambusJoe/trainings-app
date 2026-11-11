import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Exercise, DEFAULT_REST_SECONDS, getSetting } from './db'
import { getActiveWorkout } from './logic/workout'

export function useActiveWorkout() {
  return useLiveQuery(() => getActiveWorkout(), [], null)
}

export function useExerciseMap(): Map<number, Exercise> {
  const list = useLiveQuery(() => db.exercises.toArray(), [], [])
  const map = new Map<number, Exercise>()
  for (const e of list) map.set(e.id, e)
  return map
}

export function useDefaultRest(): number {
  return useLiveQuery(() => getSetting('defaultRest', DEFAULT_REST_SECONDS), [], DEFAULT_REST_SECONDS)
}

/** Re-render jede Sekunde (für Uhren). */
export function useNow(active = true, intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return now
}
