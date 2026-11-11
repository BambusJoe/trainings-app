import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Browser bitten, die Daten dauerhaft zu behalten (sonst kann Safari sie bei Speicherknappheit löschen)
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((p) => (p ? null : navigator.storage.persist())).catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
