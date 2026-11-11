import { useEffect, useState } from 'react'
import { fmtWeight, parseNumber } from '../format'

/** Zahlenfeld, das Kommas akzeptiert und erst gültige Werte speichert. */
export function NumberField({ value, placeholder, onCommit, label, decimal }: { value: number | null; placeholder: string; onCommit: (v: number | null) => void; label: string; decimal: boolean }) {
  const [text, setText] = useState(value === null ? '' : fmtWeight(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value === null ? '' : fmtWeight(value))
  }, [value, focused])
  return (
    <input
      className="num-input"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setText(t)
        const n = parseNumber(t)
        if (t === '' || n !== null) onCommit(t === '' ? null : decimal ? n : Math.round(n!))
      }}
    />
  )
}
