# MIDI Trainer

Front-end application built with Angular (TypeScript) for ear training and interacting with MIDI devices. The repository provides the source code for a single-page application that offers multiple training modes, local leaderboards, MIDI device input, audio playback via Tone.js, internationalization, and Google authentication via Firebase.

---

Table of contents
- Overview
- Features (with implementation locations)
- Requirements
- Installation and development
- Usage
- Configuration
- Build and test
- Project structure and key paths
- Privacy and security
- Contributing
- License

---

Overview

MIDI Trainer is an Angular application that helps users practice musical tasks such as playing and recognizing chords and working with scale degrees. The app supports hardware MIDI inputs, local leaderboards saved in localStorage, audio playback using Tone.js, and optional authentication via Google (Firebase).

Features (with implementation locations)

- Mode selector and application shell
  - Files: src/app/app.component.ts, src/app/app.component.html
  - Modes: play, recognize, degree, leaderboard

- Play mode (play chords)
  - Component: src/app/components/play-chord/play-chord.component.ts
  - Features: random chord generation, voicing options, streak tracking, local leaderboard

- Recognize mode (recognize chords)
  - Component: src/app/components/recognize-chord/recognize-chord.component.ts
  - Features: attempt tracking, elapsed time calculation, persistent local leaderboard

- Degree mode (degree/scale exercises)
  - Component: src/app/components/play-degree/play-degree.component.ts

- Leaderboard and results table
  - Component: src/app/components/result-table/result-table.component.ts
  - Template: src/app/components/result-table/result-table.component.html
  - Features: load/save from localStorage, filtering by input source and game type

- MIDI input support
  - Service: src/app/services/midi.service.ts
  - UI: device selection in src/app/app.component.html

- Audio playback
  - Library: Tone.js (imported in components that play sound, e.g. recognize-chord)
  - Voicing configuration: src/app/config/chord-voicings.ts

- Keyboard and input components
  - Virtual keyboard: src/app/components/keyboard-component/keyboard-component.component.ts
  - Keyboard service: src/app/services/keyboard.service.ts

- Internationalization (i18n)
  - Service: src/app/services/i18n.service.ts
  - Supported languages: 'it' and 'en'
  - Translation pipe: src/app/pipes/translate.pipe.ts

- Authentication (Google via Firebase)
  - Service: src/app/services/auth.service.ts
  - Firebase config: src/environments/environment.ts
  - Firebase initialization: src/app/config/firebase.ts

- Persistence
  - Local leaderboards and settings saved using localStorage (keys defined in the respective components)

- Styling and layout
  - Global styles: src/styles.css
  - App styles: src/app/app.component.css and component-level CSS files

Requirements

- Node.js (recommended >= 18)
- npm or yarn
- Browser with Web MIDI API support for hardware MIDI I/O (for example: Chrome)
- If using Google authentication: a Firebase project configured for the app

Installation and development

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/andreabeltrami/midi.git
cd midi
npm install
# or
# yarn install
```

2. Start the development server:

```bash
npx ng serve
# or, if Angular CLI is installed globally:
# ng serve
```

3. Open the app in a browser:

http://localhost:4200/

Build and production

Build a production-optimized bundle:

```bash
ng build --configuration production
```

Artifacts are placed in the dist/ directory.

Testing

- Unit tests (if configured):

```bash
ng test
```

- End-to-end tests (configure an e2e framework before running):

```bash
ng e2e
```

Configuration

- Firebase
  - The Firebase configuration object is read from src/environments/environment.ts and the app initializes Firebase in src/app/config/firebase.ts.
  - Replace the values in environment.ts to use a different Firebase project.

- MIDI
  - The application uses the Web MIDI API via src/app/services/midi.service.ts. Grant MIDI permissions in the browser and select the desired input device from the UI.

Usage (quick guide)

- Language: change the UI language using the language control that calls the I18nService (src/app/services/i18n.service.ts).
- MIDI device: select an available MIDI input from the device selector in the top bar.
- Authentication: sign in with Google using the authentication control (AuthService). Authentication is optional.
- Modes:
  - Play: practice playing chords (src/app/components/play-chord).
  - Recognize: listen and recognize chords (src/app/components/recognize-chord).
  - Degree: practice degrees and scale-related tasks (src/app/components/play-degree).
  - Leaderboard: view saved runs and filter results (src/app/components/result-table).

Project structure and key paths

- Entry point
  - src/main.ts -> bootstrapApplication(AppComponent)

- App shell and routing
  - src/app/app.component.ts
  - src/app/app.component.html

- Main components
  - src/app/components/play-chord/
  - src/app/components/recognize-chord/
  - src/app/components/play-degree/
  - src/app/components/result-table/
  - src/app/components/keyboard-component/

- Services
  - src/app/services/midi.service.ts
  - src/app/services/i18n.service.ts
  - src/app/services/auth.service.ts
  - src/app/services/keyboard.service.ts

- Config
  - src/environments/environment.ts (firebaseConfig)
  - src/app/config/firebase.ts

Privacy and security

- Firebase configuration is stored in environment.ts. Verify that the values are appropriate for the target environment.
- Leaderboard data is stored locally in the browser's localStorage. If server-side persistence is required, implement storage in a backend or Firestore and update the services accordingly.

Contributing

- Open an issue to discuss new features or bugs.
- Create a feature branch from the main branch.
- Submit a pull request with a clear description of changes.
- Include tests and follow repository formatting/linting rules where applicable.

License

Specify a license for the project (for example: MIT). Add a LICENSE file at the repository root if desired.
