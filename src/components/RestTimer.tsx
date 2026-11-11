import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtClock } from '../format'

interface TimerState {
  endAt: number
  total: number
}

interface RestTimerApi {
  start: (seconds: number) => void
  adjust: (deltaSeconds: number) => void
  stop: () => void
  state: TimerState | null
  /** Muss aus einer Nutzer-Geste heraus aufgerufen werden (iOS), damit der Ton später spielen darf. */
  unlockAudio: () => void
}

const Ctx = createContext<RestTimerApi | null>(null)
const STORAGE_KEY = 'restTimer'

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as TimerState
    return s.endAt > Date.now() ? s : null
  } catch {
    return null
  }
}

function save(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* privates Fenster o. ä. – Timer läuft trotzdem im Speicher */
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState | null>(load)
  const audio = useRef<AudioContext | null>(null)

  const update = useCallback((s: TimerState | null) => {
    setState(s)
    save(s)
  }, [])

  const unlockAudio = useCallback(() => {
    try {
      if (!audio.current) audio.current = new AudioContext()
      if (audio.current.state === 'suspended') void audio.current.resume()
    } catch {
      /* kein Audio verfügbar */
    }
  }, [])

  const beep = useCallback(() => {
    const ctx = audio.current
    if (ctx) {
      // drei kurze Töne
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.25
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.2)
      }
    }
    if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200])
  }, [])

  // Ablauf prüfen
  useEffect(() => {
    if (!state) return
    const ms = state.endAt - Date.now()
    if (ms <= 0) {
      update(null)
      return
    }
    const id = setTimeout(() => {
      beep()
      update(null)
    }, ms)
    return () => clearTimeout(id)
  }, [state, beep, update])

  const api: RestTimerApi = {
    state,
    unlockAudio,
    start: (seconds) => (seconds > 0 ? update({ endAt: Date.now() + seconds * 1000, total: seconds }) : update(null)),
    adjust: (delta) => {
      if (!state) return
      const endAt = state.endAt + delta * 1000
      if (endAt <= Date.now()) update(null)
      else update({ endAt, total: Math.max(state.total + delta, 1) })
    },
    stop: () => update(null),
  }
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useRestTimer(): RestTimerApi {
  const c = useContext(Ctx)
  if (!c) throw new Error('RestTimerProvider fehlt')
  return c
}

export function RestTimerBar() {
  const { state, adjust, stop } = useRestTimer()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!state) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [state])
  if (!state) return null
  const left = Math.max(0, state.endAt - now)
  const progress = Math.min(1, left / (state.total * 1000))
  return (
    <div className="rest-bar" role="timer" aria-live="off">
      <div className="rest-progress" style={{ transform: `scaleX(${progress})` }} />
      <button className="btn btn-small btn-ghost" onClick={() => adjust(-15)} aria-label="15 Sekunden weniger">
        −15
      </button>
      <div className="rest-time">
        <span className="rest-label">Pause</span>
        <span className="rest-clock">{fmtClock(left + 999)}</span>
      </div>
      <button className="btn btn-small btn-ghost" onClick={() => adjust(15)} aria-label="15 Sekunden mehr">
        +15
      </button>
      <button className="btn btn-small" onClick={stop}>
        Weiter
      </button>
    </div>
  )
}
