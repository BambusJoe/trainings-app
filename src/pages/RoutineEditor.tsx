import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, normalizeRoutineItem, type Exercise, type Routine, type RoutineItem, type RoutineSet } from '../db'
import { useDefaultRest, useExerciseMap } from '../hooks'
import { lastPerformance } from '../logic/stats'
import { suggestRoutineSets } from '../logic/workout'
import { ExercisePicker } from '../components/ExercisePicker'
import { Dialog } from '../components/Dialog'
import { NumberField } from '../components/NumberField'
import { fmtRelative, fmtRest, fmtSet, fmtWeight } from '../format'
import { Icon } from '../components/Icon'

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300]

export default function RoutineEditor() {
  const { id } = useParams()
  const isNew = id === 'neu'
  const navigate = useNavigate()
  const exercises = useExerciseMap()
  const defaultRest = useDefaultRest()
  const [name, setName] = useState('')
  const [items, setItems] = useState<RoutineItem[]>([])
  const [loaded, setLoaded] = useState(isNew)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isNew) return
    db.routines.get(Number(id)).then((r) => {
      if (!r) return navigate('/', { replace: true })
      setName(r.name)
      setItems(r.items.map(normalizeRoutineItem))
      setLoaded(true)
    })
  }, [id, isNew, navigate])

  function patch(i: number, p: Partial<RoutineItem>) {
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...p } : it)))
  }
  function move(i: number, d: -1 | 1) {
    setItems((list) => {
      const j = i + d
      if (j < 0 || j >= list.length) return list
      const copy = [...list]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  async function addExercises(ids: number[]) {
    setPicking(false)
    const fresh = ids.filter((exId) => !items.some((it) => it.exerciseId === exId))
    // Werte vom letzten Mal als Startwerte übernehmen
    const added = await Promise.all(fresh.map(async (exerciseId) => ({ exerciseId, sets: await suggestRoutineSets(exerciseId), restSeconds: defaultRest })))
    setItems((l) => [...l, ...added])
  }

  async function save() {
    const clean = name.trim() || 'Neue Routine'
    const cleanItems = items.map((it) => ({ ...it, sets: it.sets.length ? it.sets : [{ weight: null, reps: null }] }))
    if (isNew) {
      const max = (await db.routines.orderBy('sortOrder').last())?.sortOrder ?? -1
      await db.routines.add({ name: clean, items: cleanItems, sortOrder: max + 1 } as Routine)
    } else {
      await db.routines.update(Number(id), { name: clean, items: cleanItems })
    }
    navigate('/')
  }

  async function remove() {
    await db.routines.delete(Number(id))
    navigate('/')
  }

  if (!loaded) return null

  return (
    <div className="page">
      <header className="page-head page-head-bar">
        <button className="btn btn-ghost btn-small" onClick={() => navigate(-1)}>
          Abbrechen
        </button>
        <h1 className="page-title-small">{isNew ? 'Neue Routine' : 'Routine'}</h1>
        <button className="btn btn-primary btn-small" onClick={save}>
          Speichern
        </button>
      </header>

      <label className="field">
        <span className="field-label">Name</span>
        <input className="input input-large" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Push" autoFocus={isNew} />
      </label>

      <ul className="cards">
        {items.map((it, i) => (
          <RoutineExerciseCard
            key={`${it.exerciseId}-${i}`}
            item={it}
            exercise={exercises.get(it.exerciseId)}
            isFirst={i === 0}
            isLast={i === items.length - 1}
            onChange={(p) => patch(i, p)}
            onMove={(d) => move(i, d)}
            onRemove={() => setItems((l) => l.filter((_, j) => j !== i))}
          />
        ))}
      </ul>

      <button className="btn btn-block" onClick={() => setPicking(true)}>
        <Icon name="plus" size={18} /> Übung hinzufügen
      </button>

      {!isNew && (
        <button className="btn btn-block btn-ghost btn-danger-text" onClick={() => setConfirmDelete(true)}>
          Routine löschen
        </button>
      )}

      {picking && <ExercisePicker exclude={items.map((i) => i.exerciseId)} onClose={() => setPicking(false)} onPick={addExercises} />}
      {confirmDelete && (
        <Dialog title={`„${name}“ löschen?`} onClose={() => setConfirmDelete(false)} actions={[{ label: 'Löschen', kind: 'danger', onClick: remove }]}>
          <p>Deine bisherigen Trainings mit dieser Routine bleiben im Tagebuch erhalten.</p>
        </Dialog>
      )}
    </div>
  )
}

function RoutineExerciseCard({
  item,
  exercise,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  item: RoutineItem
  exercise: Exercise | undefined
  isFirst: boolean
  isLast: boolean
  onChange: (p: Partial<RoutineItem>) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const last = useLiveQuery(() => lastPerformance(item.exerciseId), [item.exerciseId])
  const lastWorking = last?.sets.filter((s) => !s.isWarmup) ?? []

  function setRow(j: number, p: Partial<RoutineSet>) {
    onChange({ sets: item.sets.map((s, k) => (k === j ? { ...s, ...p } : s)) })
  }
  function addRow() {
    const prev = item.sets[item.sets.length - 1]
    onChange({ sets: [...item.sets, { weight: prev?.weight ?? null, reps: prev?.reps ?? null }] })
  }
  function removeRow(j: number) {
    onChange({ sets: item.sets.filter((_, k) => k !== j) })
  }
  function takeLast() {
    onChange({ sets: lastWorking.map((s) => ({ weight: s.weight, reps: s.reps })) })
  }

  const differsFromLast =
    lastWorking.length > 0 && (lastWorking.length !== item.sets.length || lastWorking.some((s, j) => s.weight !== item.sets[j]?.weight || s.reps !== item.sets[j]?.reps))

  return (
    <li className="card exercise-block">
      <div className="row-between">
        <h3 className="exercise-name">{exercise?.name ?? '…'}</h3>
        <div className="icon-group">
          <button className="icon-btn" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Nach oben">
            <Icon name="chevronUp" />
          </button>
          <button className="icon-btn" onClick={() => onMove(1)} disabled={isLast} aria-label="Nach unten">
            <Icon name="chevronDown" />
          </button>
          <button className="icon-btn" onClick={onRemove} aria-label="Übung entfernen">
            <Icon name="close" />
          </button>
        </div>
      </div>

      <p className="muted small last-line">
        {last ? (
          <>
            Zuletzt {fmtRelative(last.workout.startedAt)}: {lastWorking.map((s) => fmtSet(s.weight, s.reps)).join(', ') || '–'}
            {differsFromLast && (
              <>
                {' · '}
                <button className="link-btn" onClick={takeLast}>
                  übernehmen
                </button>
              </>
            )}
          </>
        ) : (
          'Noch nie gemacht – trage Startwerte ein oder lass die Felder leer.'
        )}
      </p>

      <div className="set-table set-table-routine">
        <div className="set-row set-head">
          <span>Satz</span>
          <span>kg</span>
          <span>Wdh.</span>
          <span aria-hidden="true" />
        </div>
        {item.sets.map((s, j) => {
          const prev = lastWorking[j]
          return (
            <div key={j} className="set-row">
              <span className="set-no">{j + 1}</span>
              <NumberField
                label={`Satz ${j + 1} Gewicht in kg`}
                decimal
                value={s.weight}
                placeholder={prev?.weight != null ? fmtWeight(prev.weight) : 'kg'}
                onCommit={(v) => setRow(j, { weight: v })}
              />
              <NumberField
                label={`Satz ${j + 1} Wiederholungen`}
                decimal={false}
                value={s.reps}
                placeholder={prev?.reps != null ? String(prev.reps) : 'Wdh.'}
                onCommit={(v) => setRow(j, { reps: v })}
              />
              <button className="icon-btn" onClick={() => removeRow(j)} disabled={item.sets.length <= 1} aria-label={`Satz ${j + 1} entfernen`}>
                <Icon name="close" size={18} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="row-between routine-item-controls">
        <button className="btn btn-ghost btn-small" onClick={addRow}>
          <Icon name="plus" size={18} /> Satz
        </button>
        <label className="select-wrap">
          <span className="muted small">Pause</span>
          <select className="select" value={item.restSeconds} onChange={(e) => onChange({ restSeconds: Number(e.target.value) })}>
            {[...new Set([...REST_OPTIONS, item.restSeconds])]
              .sort((a, b) => a - b)
              .map((sec) => (
                <option key={sec} value={sec}>
                  {fmtRest(sec)}
                </option>
              ))}
          </select>
        </label>
      </div>
    </li>
  )
}
