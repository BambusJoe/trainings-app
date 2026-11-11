import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getOrCreateExercise } from '../db'
import { EXERCISE_POOL, MUSCLES, findPoolEntry, matchesQuery } from '../data/exercisePool'
import { Sheet } from './Dialog'
import { Icon } from './Icon'

interface Item {
  key: string
  name: string
  muscle?: string
  aliases: string[]
  exerciseId?: number
  lastUsed: number
}

const OWN = 'Eigene'
const ALL = 'Alle'

/**
 * Übungen aus dem Pool und den eigenen Übungen suchen und (mehrere) auswählen.
 * Pool-Übungen werden erst beim Hinzufügen in der Datenbank angelegt.
 */
export function ExercisePicker({ onPick, onClose, exclude = [] }: { onPick: (exerciseIds: number[]) => void; onClose: () => void; exclude?: number[] }) {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState<string>(ALL)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const lastUsed = useLiveQuery(async () => {
    const workouts = new Map((await db.workouts.toArray()).map((w) => [w.id, w.startedAt]))
    const m = new Map<number, number>()
    await db.sets.each((s) => {
      const t = workouts.get(s.workoutId) ?? 0
      if (t > (m.get(s.exerciseId) ?? 0)) m.set(s.exerciseId, t)
    })
    return m
  }, [])

  const items = useMemo<Item[]>(() => {
    if (!exercises) return []
    const own: Item[] = exercises
      .filter((e) => !exclude.includes(e.id))
      .map((e) => {
        const pool = findPoolEntry(e.name)
        return { key: `db:${e.id}`, name: e.name, muscle: e.muscle ?? pool?.muscle, aliases: pool?.aliases ?? [], exerciseId: e.id, lastUsed: lastUsed?.get(e.id) ?? 0 }
      })
    const known = new Set(exercises.map((e) => e.name.toLowerCase()))
    const pool: Item[] = EXERCISE_POOL.filter((p) => !known.has(p.name.toLowerCase())).map((p) => ({
      key: `pool:${p.name}`,
      name: p.name,
      muscle: p.muscle,
      aliases: p.aliases,
      lastUsed: 0,
    }))
    return [...own, ...pool]
  }, [exercises, exclude, lastUsed])

  const query = q.trim()
  const isOwn = (it: Item) => !findPoolEntry(it.name)
  const filtered = items.filter((it) => (chip === ALL || (chip === OWN ? isOwn(it) : it.muscle === chip)) && matchesQuery(query, it.name, it.aliases))
  const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, 'de')
  const byRecent = (a: Item, b: Item) => b.lastUsed - a.lastUsed || byName(a, b)

  // Abschnitte: ohne Suche nach Muskelgruppe gruppiert, mit Suche als eine Liste
  const sections: { title: string; items: Item[] }[] = []
  if (query) {
    sections.push({ title: '', items: [...filtered].sort(byRecent) })
  } else {
    const recent = filtered.filter((it) => it.lastUsed > 0).sort(byRecent).slice(0, 8)
    if (chip === ALL && recent.length) sections.push({ title: 'Zuletzt verwendet', items: recent })
    if (chip === ALL) {
      // eigene Übungen ohne Muskelgruppe landen unter „Eigene“
      for (const g of [...MUSCLES, OWN]) {
        const list = filtered.filter((it) => (g === OWN ? !it.muscle : it.muscle === g)).sort(byName)
        if (list.length) sections.push({ title: g, items: list })
      }
    } else if (filtered.length) {
      sections.push({ title: chip, items: [...filtered].sort(byName) })
    }
  }

  const exact = items.some((it) => it.name.toLowerCase() === query.toLowerCase()) || (exercises ?? []).some((e) => e.name.toLowerCase() === query.toLowerCase())

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  async function createCustom() {
    const id = await getOrCreateExercise(query)
    setSelected((s) => [...s, `db:${id}`])
    setQ('')
  }

  async function confirm() {
    if (busy || selected.length === 0) return
    setBusy(true)
    const ids: number[] = []
    for (const key of selected) {
      if (key.startsWith('db:')) ids.push(Number(key.slice(3)))
      else ids.push(await getOrCreateExercise(key.slice(5)))
    }
    onPick(ids)
  }

  return (
    <Sheet title="Übungen hinzufügen" onClose={onClose}>
      <div className="picker-top">
        <input
          className="input"
          type="search"
          placeholder="Übung suchen, z. B. „Bankdrücken“"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          aria-label="Übung suchen"
        />
        <div className="chips" role="tablist" aria-label="Muskelgruppe">
          {[ALL, ...MUSCLES, OWN].map((c) => (
            <button key={c} role="tab" aria-selected={chip === c} className={`chip ${chip === c ? 'chip-on' : ''}`} onClick={() => setChip(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {sections.map((sec) => (
        <section key={sec.title || 'results'}>
          {sec.title && <h3 className="picker-section">{sec.title}</h3>}
          <ul className="list">
            {sec.items.map((it) => {
              const on = selected.includes(it.key)
              return (
                <li key={it.key}>
                  <button className={`list-row pick-row ${on ? 'pick-on' : ''}`} onClick={() => toggle(it.key)} aria-pressed={on}>
                    <span className="pick-text">
                      <span>{it.name}</span>
                      {(query || chip === ALL) && it.muscle && sec.title !== it.muscle && <span className="muted small">{it.muscle}</span>}
                    </span>
                    <span className="pick-box" aria-hidden="true">
                      {on && <Icon name="check" size={16} strokeWidth={3.5} />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {exercises && filtered.length === 0 && <p className="muted center picker-empty">Nicht im Pool gefunden.</p>}

      {query && !exact && (
        <button className="list-row list-row-create" onClick={createCustom}>
          <Icon name="plus" size={18} /> „{query}“ als eigene Übung anlegen
        </button>
      )}

      <div className="picker-footer">
        <button className="btn btn-primary btn-block" disabled={selected.length === 0 || busy} onClick={confirm}>
          {selected.length === 0 ? 'Übungen antippen zum Auswählen' : selected.length === 1 ? '1 Übung hinzufügen' : `${selected.length} Übungen hinzufügen`}
        </button>
      </div>
    </Sheet>
  )
}
