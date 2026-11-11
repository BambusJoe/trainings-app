import { useEffect, useState } from 'react'
import { useDefaultRest, useExerciseMap } from '../hooks'
import { createRoutines, routineCandidates, type RoutineCandidate } from '../logic/routinesFromHistory'
import { fmtRelative } from '../format'
import { Sheet } from './Dialog'
import { Icon } from './Icon'

/**
 * Schlägt Routinen aus dem Tagebuch vor (ein Vorschlag pro Trainingsname, Werte vom letzten Mal)
 * und legt die ausgewählten an.
 */
export function RoutinesFromHistory({ onClose, onDone }: { onClose: () => void; onDone: (created: number) => void }) {
  const rest = useDefaultRest()
  const exercises = useExerciseMap()
  const [candidates, setCandidates] = useState<RoutineCandidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    routineCandidates(rest).then((list) => {
      setCandidates(list)
      // Einmalige Trainings nicht vorauswählen (wenn es wiederholte gibt) – das sind meist keine echten Routinen
      const hasRepeated = list.some((c) => !c.exists && c.count > 1)
      setSelected(new Set(list.filter((c) => !c.exists && (c.count > 1 || !hasRepeated)).map((c) => c.name)))
    })
  }, [rest])

  function toggle(name: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function create() {
    if (!candidates || busy) return
    setBusy(true)
    const created = await createRoutines(candidates.filter((c) => selected.has(c.name)))
    onDone(created)
  }

  const count = selected.size

  return (
    <Sheet title="Routinen aus dem Tagebuch" onClose={onClose}>
      <p className="muted small">
        Pro Trainingsname eine Routine. Übungen, Reihenfolge, Gewichte und Wiederholungen stammen aus dem letzten Training mit diesem Namen. Du kannst alles danach anpassen.
      </p>

      {candidates === null && <p className="muted center">Lese Tagebuch …</p>}
      {candidates?.length === 0 && <p className="muted center picker-empty">Im Tagebuch gibt es noch keine abgeschlossenen Trainings.</p>}

      <ul className="list">
        {candidates?.map((c) => {
          const on = selected.has(c.name)
          const names = c.items.map((it) => exercises.get(it.exerciseId)?.name).filter(Boolean)
          return (
            <li key={c.name}>
              <button className={`list-row pick-row ${on ? 'pick-on' : ''}`} onClick={() => !c.exists && toggle(c.name)} aria-pressed={on} disabled={c.exists}>
                <span className="pick-text">
                  <span className="pick-title">{c.name}</span>
                  <span className="muted small">
                    {c.exists ? 'Routine gibt es schon' : `${c.count}× gemacht · zuletzt ${fmtRelative(c.lastDate)} · ${c.items.length} ${c.items.length === 1 ? 'Übung' : 'Übungen'}`}
                  </span>
                  {!c.exists && <span className="muted small clamp-2">{names.join(' · ')}</span>}
                </span>
                {!c.exists && <span className="pick-box">{on && <Icon name="check" size={16} strokeWidth={3.5} />}</span>}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="picker-footer">
        <button className="btn btn-primary btn-block" disabled={count === 0 || busy} onClick={create}>
          {count === 0 ? 'Trainings antippen zum Auswählen' : count === 1 ? '1 Routine anlegen' : `${count} Routinen anlegen`}
        </button>
      </div>
    </Sheet>
  )
}
