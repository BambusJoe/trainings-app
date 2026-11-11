import { useEffect, type ReactNode } from 'react'

export interface DialogAction {
  label: string
  onClick: () => void
  kind?: 'primary' | 'danger' | 'plain'
}

/** Zentrierter Dialog mit Aktionen untereinander (gut mit dem Daumen erreichbar). */
export function Dialog({ title, children, actions, onClose }: { title: string; children?: ReactNode; actions: DialogAction[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children && <div className="dialog-body">{children}</div>}
        <div className="dialog-actions">
          {actions.map((a) => (
            <button key={a.label} className={`btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : ''}`} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
          <button className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

/** Bottom-Sheet für längere Inhalte (Übungsauswahl). */
export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay overlay-sheet" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-small" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
