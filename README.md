# OBS Study Overlay — Complete Version

Dieses Projekt ist ein vollständiges Lernstream-Overlay, das du in **OBS** als Browserquelle einbinden kannst.

Empfohlene Größe: **1920×1080**. Öffne `index.html` per Localhost (Live Server) oder gib die Datei als lokale Browserquelle in OBS an.

## Schnellstart
1. Entpacke das ZIP und öffne den Ordner in VS Code.
2. Passe `config.json` an (Twitch-Channel, Bilder, Pomodoro-Zeiten).
3. Optional: Starte `Live Server` in VS Code oder öffne `index.html` im Browser.
4. In OBS: Quelle hinzufügen → **Browser** → URL z. B. `http://localhost:5500/index.html?channel=DEINCHANNEL`  
   Oder aktiviere **Lokale Datei** und wähle `index.html`.

## Hotkeys (im Overlay)
- Leertaste: Start/Pause Timer
- R: Reset
- N: Nächste Phase
- T: Fokus To-Do eingeben

## Dateien
- `index.html` – Hauptseite
- `css/styles.css` – Styling
- `js/main.js` – Logik
- `config.json` – Einstellungen
- `assets/images/` – Beispielbilder (SVG)

© 2025-11-19
