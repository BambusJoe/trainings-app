import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { RestTimerBar, RestTimerProvider, useRestTimer } from './components/RestTimer'
import { useActiveWorkout, useNow } from './hooks'
import { fmtClock } from './format'
import StartPage from './pages/StartPage'
import RoutineEditor from './pages/RoutineEditor'
import WorkoutPage from './pages/WorkoutPage'
import HistoryPage from './pages/HistoryPage'
import WorkoutDetail from './pages/WorkoutDetail'
import ExercisesPage from './pages/ExercisesPage'
import ExerciseDetail from './pages/ExerciseDetail'
import SettingsPage from './pages/SettingsPage'
import { Icon, type IconName } from './components/Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Training', icon: 'dumbbell' },
  { to: '/tagebuch', label: 'Tagebuch', icon: 'journal' },
  { to: '/uebungen', label: 'Übungen', icon: 'chart' },
  { to: '/einstellungen', label: 'Mehr', icon: 'sliders' },
]

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `tab ${isActive ? 'tab-active' : ''}`}>
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/** Hinweis „Training läuft“ auf allen anderen Seiten – zeigt die laufende Pause, falls aktiv. */
function ActiveWorkoutBar() {
  const active = useActiveWorkout()
  const { state: rest } = useRestTimer()
  const now = useNow(!!active, rest ? 250 : 1000)
  const navigate = useNavigate()
  if (!active) return null
  const restLeft = rest ? rest.endAt - now : 0
  return (
    <button className="active-bar" onClick={() => navigate('/training')}>
      <span className="pulse" aria-hidden="true" />
      <span className="active-bar-name">{active.name}</span>
      {restLeft > 0 ? (
        <span className="active-bar-time active-bar-rest">
          <Icon name="timer" size={16} /> {fmtClock(restLeft + 999)}
        </span>
      ) : (
        <span className="active-bar-time">{fmtClock(now - active.startedAt)}</span>
      )}
      <span className="active-bar-cta">
        Fortsetzen <Icon name="chevronRight" size={16} strokeWidth={2.5} />
      </span>
    </button>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const inWorkout = pathname.startsWith('/training')
  return (
    <div className="app">
      <main className="content">
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/routine/:id" element={<RoutineEditor />} />
          <Route path="/training" element={<WorkoutPage />} />
          <Route path="/tagebuch" element={<HistoryPage />} />
          <Route path="/tagebuch/:id" element={<WorkoutDetail />} />
          <Route path="/uebungen" element={<ExercisesPage />} />
          <Route path="/uebungen/:id" element={<ExerciseDetail />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
        </Routes>
      </main>
      <div className="bottom-stack">
        {inWorkout && <RestTimerBar />}
        {!inWorkout && <ActiveWorkoutBar />}
        {!inWorkout && <TabBar />}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <RestTimerProvider>
        <Layout />
      </RestTimerProvider>
    </HashRouter>
  )
}
