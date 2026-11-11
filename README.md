# Trainingstagebuch

Schlichte Trainings-App (PWA) fürs iPhone: Routinen ohne Limit, Sätze loggen, „Zuletzt“-Werte, Pausentimer, Fortschritt pro Übung, Hevy-Import, Backup. Alle Daten bleiben lokal auf dem Gerät (IndexedDB).

## Befehle

```bash
npm install          # einmalig
npm run dev -- --host   # Dev-Server, auch im WLAN erreichbar
npm test             # Logik-Tests (Vitest)
npm run build        # Produktions-Build nach dist/
```

## Auf dem iPhone testen

1. Mac und iPhone im selben WLAN, `npm run dev -- --host` starten.
2. In Safari die angezeigte `Network`-Adresse öffnen (z. B. `http://<Mac-IP>:5173`).
3. Teilen → „Zum Home-Bildschirm“.

Achtung: Ohne HTTPS gibt es keinen Offline-Modus, und die Daten hängen an genau dieser Adresse.

## Live-Version

Jeder Push auf `main` testet, baut und veröffentlicht die App per GitHub Actions auf GitHub Pages:
https://bambusjoe.github.io/trainings-app/

Auf dem iPhone in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Die Daten liegen nur auf dem Gerät; regelmäßig unter „Mehr“ ein Backup exportieren.

## Aufbau

- `src/db.ts` – Datenmodell (Dexie)
- `src/logic/` – Kernlogik mit Tests: „Zuletzt“, 1RM/Rekorde, Hevy-CSV-Import, Backup, Trainingsablauf
- `src/pages/` – Screens, `src/components/` – Satz-Tabelle, Pausentimer, Diagramm, Dialoge
