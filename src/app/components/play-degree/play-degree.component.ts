import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { ChordDefinition } from '../../types/chord-definition';
import { Note } from '../../types/note';
import { ChordType } from '../../enums/chord-type';
import { getNoteLabel, NoteType } from '../../enums/note-type';
import { Interval } from '../../enums/interval';
import { MidiEventType } from '../../enums/midi-event-type';
import { PianoKey } from '../../types/piano-key';
import { ChordDegree, getDegreeLabel } from '../../enums/chord-degree';
import { ScaleType, getScaleLabel, getMajorScales, getModes } from '../../enums/scale-type';
import { degreeToDegreeLabel } from '../../config/chord-degree-mapping';
import { CHORD_AVAILABLE_DEGREES, SCALE_AVAILABLE_DEGREES } from '../../config/degree-config';
import * as Tone from 'tone';
import { KeyboardService } from '../../services/keyboard.service';
import { KeyboardComponentComponent } from '../keyboard-component/keyboard-component.component';
import { GameRunRecord } from '../../types/game-run-record';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-play-degree',
  imports: [KeyboardComponentComponent, TranslatePipe],
  templateUrl: './play-degree.component.html',
  styleUrl: './play-degree.component.css',
})
export class PlayDegreeComponent implements OnDestroy {
  private static readonly LEADERBOARD_STORAGE_KEY_CHORD = 'play-degree-chord-leaderboard-v1';
  private static readonly LEADERBOARD_STORAGE_KEY_MAJOR = 'play-degree-major-leaderboard-v1';
  private static readonly LEADERBOARD_STORAGE_KEY_MODES = 'play-degree-modes-leaderboard-v1';
  private static readonly TARGET_STREAK = 5;

  playMode = signal<'chord' | 'major' | 'modes'>('chord');

  currentChord = signal<ChordDefinition>(PlayDegreeComponent.generateRandomChord());
  currentScale = signal<ScaleType>(PlayDegreeComponent.getRandomScale());
  currentDegree = signal<ChordDegree>(CHORD_AVAILABLE_DEGREES[0]); // Will be set by getRandomDegree() after playMode is ready
  currentChordWrong = signal(false);
  currentChordCorrect = signal(false);

  gameActive = signal(false);
  currentStreak = signal(0);
  totalGuesses = signal(0);
  wrongGuesses = signal(0);
  elapsedSeconds = signal(0);
  chordLeaderboard = signal<GameRunRecord[]>([]);
  majorLeaderboard = signal<GameRunRecord[]>([]);
  modesLeaderboard = signal<GameRunRecord[]>([]);
  latestResult = signal<GameRunRecord | null>(null);

  currentLeaderboard = computed(() => {
    switch (this.playMode()) {
      case 'chord':
        return this.chordLeaderboard();
      case 'major':
        return this.majorLeaderboard();
      case 'modes':
        return this.modesLeaderboard();
    }
  });

  displayLabel = computed(() => {
    if (this.playMode() === 'chord') {
      const chord = this.currentChord();
      if (!chord) return '';

      const qualityByChordType: Record<ChordType, string> = {
        [ChordType.Minor7]: '-7',
        [ChordType.Perfect7]: '7',
        [ChordType.Major7]: 'Maj7',
      };

      const baseNoteLabel = chord.displayBaseNote ?? getNoteLabel(chord.baseNote);
      return `${baseNoteLabel}${qualityByChordType[chord.type] ?? ''}`;
    } else if (this.playMode() === 'major') {
      // Scala Maggiore: mostra solo la nota
      const baseNote = this.currentChord();
      const baseNoteLabel = baseNote.displayBaseNote ?? getNoteLabel(baseNote.baseNote);
      return baseNoteLabel;
    } else {
      // Modes: mostra nota + nome del modo
      const scale = this.currentScale();
      const baseNote = this.currentChord();
      const baseNoteLabel = baseNote.displayBaseNote ?? getNoteLabel(baseNote.baseNote);
      return `${baseNoteLabel} ${getScaleLabel(scale)}`;
    }
  });

  currentDegreeLabel = computed(() => getDegreeLabel(this.currentDegree()));

  lastMidiEventType = MidiEventType.Released;
  sampler?: Tone.Sampler;
  private gameStartTimestamp = 0;
  private timerIntervalId?: ReturnType<typeof setInterval>;
  private currentRunGuessedChords: string[] = [];

  constructor(protected keyboardService: KeyboardService) {
    keyboardService.onPianoManuallyKeyPressed$.subscribe((pianoKey) => {
      this.onPianoKeyManuallyPressed(pianoKey);
    });

    this.InitializeMidiConnection();
    this.InitializeToneSampler();
    this.loadLeaderboards();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  public get targetStreak() {
    return PlayDegreeComponent.TARGET_STREAK;
  }

  public getElapsedLabel(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secondsPart = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${secondsPart}`;
  }

  public getElapsedLabelFromMs(milliseconds: number): string {
    return this.getElapsedLabel(Math.floor(milliseconds / 1000));
  }

  public startChallenge() {
    this.latestResult.set(null);
    this.clearFeedback();
    this.currentStreak.set(0);
    this.totalGuesses.set(0);
    this.wrongGuesses.set(0);
    this.elapsedSeconds.set(0);
    this.currentRunGuessedChords = [];
    this.gameActive.set(true);

    this.stopTimer();
    this.gameStartTimestamp = Date.now();
    this.timerIntervalId = setInterval(() => {
      this.elapsedSeconds.set(Math.floor((Date.now() - this.gameStartTimestamp) / 1000));
    }, 250);

    this.resetPressedNotes();
    this.generateNewChordAndDegree();
  }

  public abortChallenge() {
    this.gameActive.set(false);
    this.currentStreak.set(0);
    this.totalGuesses.set(0);
    this.wrongGuesses.set(0);
    this.elapsedSeconds.set(0);
    this.currentRunGuessedChords = [];
    this.stopTimer();
    this.clearFeedback();
    this.resetPressedNotes();
  }

  public resetPressedNotes() {
    [...this.keyboardService.pressedNotes()].forEach((note) => {
      this.handleNote(MidiEventType.Released, note.originalNumber, 127);
    });
  }

  public selectMode(mode: 'chord' | 'major' | 'modes') {
    if (this.gameActive()) {
      return; // Non permettere il cambio durante il gioco
    }
    this.playMode.set(mode);
    this.clearFeedback();
    this.resetPressedNotes();
    this.generateNewChordAndDegree(); // Aggiorna accordo e scale per la nuova modalità
  }

  private InitializeToneSampler() {
    try {
      this.sampler = new Tone.Sampler({
        urls: {
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
        },
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
      Tone.start();
    } catch (e) {
      console.error(e);
    }
  }

  private InitializeMidiConnection() {
    try {
      navigator.requestMIDIAccess().then(this.onMidiAccess, (x) => {
        console.error(x);
      });
    } catch (e) {
      console.error(e);
    }
  }

  private onPianoKeyManuallyPressed(pianoKey: PianoKey) {
    if (pianoKey.isPressed()) {
      this.handleNote(MidiEventType.Released, pianoKey.note.originalNumber, 127);
    } else {
      this.handleNote(MidiEventType.Pressed, pianoKey.note.originalNumber, 127);
    }
  }

  private onMidiAccess = (midiAccess: MIDIAccess) => {
    const midiInput = midiAccess.inputs.get('input-0');
    if (midiInput) {
      midiInput.onmidimessage = this.onMIDIMessage;
    }
  };

  private onMIDIMessage = (event: MIDIMessageEvent): void => {
    if (!event.data) {
      return;
    }

    this.handleNote(event.data[0], event.data[1], event.data[2]);
  };

  private handleNote(status: number, noteId: number, velocity: number) {
    this.playSound(status, noteId, velocity);

    const eventType = velocity === 0 ? MidiEventType.Released : status;
    const rawNote = noteId;

    let pressedNotes = this.keyboardService.pressedNotes();
    this.lastMidiEventType = eventType;

    if (eventType === MidiEventType.Pressed) {
      pressedNotes.push(new Note(rawNote));
    } else if (eventType === MidiEventType.Released) {
      const note = new Note(rawNote);
      pressedNotes = this.keyboardService.pressedNotes().filter((x) => x.name !== note.name);
    }

    this.keyboardService.pressedNotes.set([...pressedNotes]);

    if (this.needCheckDegree()) {
      this.processGuess(this.checkDegree());
    }
  }

  private processGuess(matches: boolean) {
    this.clearFeedback();

    if (this.gameActive()) {
      this.totalGuesses.update((value) => value + 1);
    }

    if (matches) {
      if (this.gameActive()) {
        this.currentStreak.update((value) => value + 1);
        this.currentRunGuessedChords.push(this.getChordDegreeLabel(this.currentChord(), this.currentDegree()));
      }

      this.currentChordCorrect.set(true);

      const completedChallenge =
        this.gameActive() && this.currentStreak() >= PlayDegreeComponent.TARGET_STREAK;

      if (completedChallenge) {
        this.finishChallenge();
        setTimeout(() => this.currentChordCorrect.set(false), 500);
        return;
      }

      setTimeout(() => {
        this.currentChordCorrect.set(false);
        this.resetPressedNotes();
        this.generateNewChordAndDegree();
      }, 500);
      return;
    }

    this.currentChordWrong.set(true);
    if (this.gameActive()) {
      this.wrongGuesses.update((value) => value + 1);
      this.currentStreak.set(0);
    }
    setTimeout(() => this.currentChordWrong.set(false), 500);
  }

  private clearFeedback() {
    this.currentChordWrong.set(false);
    this.currentChordCorrect.set(false);
  }

  private finishChallenge() {
    const elapsedMs = Date.now() - this.gameStartTimestamp;
    
    let voicingStyle: 'degree' | 'major-scale' | 'modes' = 'degree';
    if (this.playMode() === 'major') {
      voicingStyle = 'major-scale';
    } else if (this.playMode() === 'modes') {
      voicingStyle = 'modes';
    }

    const newRecord: GameRunRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      completedAtIso: new Date().toISOString(),
      elapsedMs,
      totalGuesses: this.totalGuesses(),
      wrongGuesses: this.wrongGuesses(),
      voicingStyle,
      guessedChords: [...this.currentRunGuessedChords],
      gameType: 'degree',
    };

    this.latestResult.set(newRecord);
    this.gameActive.set(false);
    this.stopTimer();

    const leaderboardMap: Record<'chord' | 'major' | 'modes', [() => GameRunRecord[], (records: GameRunRecord[]) => void]> = {
      chord: [() => this.chordLeaderboard(), (records) => this.chordLeaderboard.set(records)],
      major: [() => this.majorLeaderboard(), (records) => this.majorLeaderboard.set(records)],
      modes: [() => this.modesLeaderboard(), (records) => this.modesLeaderboard.set(records)],
    };

    const [getBoard, setBoard] = leaderboardMap[this.playMode()];
    const currentBoard = getBoard();
    const updatedBoard = [...currentBoard, newRecord].sort((first, second) => {
      if (first.elapsedMs !== second.elapsedMs) {
        return first.elapsedMs - second.elapsedMs;
      }
      return first.totalGuesses - second.totalGuesses;
    });

    setBoard(updatedBoard);
    this.persistLeaderboard(updatedBoard, this.playMode());
  }

  private getChordDegreeLabel(chord: ChordDefinition, degree: ChordDegree): string {
    if (this.playMode() === 'major' || this.playMode() === 'modes') {
      const scale = this.currentScale();
      const baseNoteLabel = chord.displayBaseNote ?? getNoteLabel(chord.baseNote);
      const degreeLabel = getDegreeLabel(degree);
      return `${baseNoteLabel} ${getScaleLabel(scale)} (${degreeLabel})`;
    } else {
      const noteName = chord.displayBaseNote ?? getNoteLabel(chord.baseNote);
      const qualityByChordType: Record<ChordType, string> = {
        [ChordType.Minor7]: '-7',
        [ChordType.Perfect7]: '7',
        [ChordType.Major7]: 'Maj7',
      };
      const quality = qualityByChordType[chord.type] ?? '?';
      const degreeLabel = getDegreeLabel(degree);
      return `${noteName}${quality} (${degreeLabel})`;
    }
  }

  private persistLeaderboard(records: GameRunRecord[], mode: 'chord' | 'major' | 'modes') {
    try {
      const keyMap: Record<'chord' | 'major' | 'modes', string> = {
        chord: PlayDegreeComponent.LEADERBOARD_STORAGE_KEY_CHORD,
        major: PlayDegreeComponent.LEADERBOARD_STORAGE_KEY_MAJOR,
        modes: PlayDegreeComponent.LEADERBOARD_STORAGE_KEY_MODES,
      };
      localStorage.setItem(keyMap[mode], JSON.stringify(records));
    } catch (error) {
      console.error(error);
    }
  }

  private loadLeaderboards() {
    this.chordLeaderboard.set(this.loadLeaderboardForMode('chord'));
    this.majorLeaderboard.set(this.loadLeaderboardForMode('major'));
    this.modesLeaderboard.set(this.loadLeaderboardForMode('modes'));
  }

  private loadLeaderboardForMode(mode: 'chord' | 'major' | 'modes'): GameRunRecord[] {
    try {
      const keyMap: Record<'chord' | 'major' | 'modes', string> = {
        chord: PlayDegreeComponent.LEADERBOARD_STORAGE_KEY_CHORD,
        major: PlayDegreeComponent.LEADERBOARD_STORAGE_KEY_MAJOR,
        modes: PlayDegreeComponent.LEADERBOARD_STORAGE_KEY_MODES,
      };
      const rawValue = localStorage.getItem(keyMap[mode]);
      if (!rawValue) {
        return [];
      }

      const parsedValue = JSON.parse(rawValue) as GameRunRecord[];
      if (!Array.isArray(parsedValue)) {
        return [];
      }

      const normalizedRecords: GameRunRecord[] = parsedValue
        .filter(
          (entry) =>
            typeof entry.id === 'string' &&
            typeof entry.completedAtIso === 'string' &&
            typeof entry.elapsedMs === 'number' &&
            typeof entry.totalGuesses === 'number' &&
            typeof entry.wrongGuesses === 'number' &&
            Array.isArray(entry.guessedChords),
        )
        .map((entry) => ({
          ...entry,
          voicingStyle: typeof entry.voicingStyle === 'string' ? entry.voicingStyle : 'Unknown',
          gameType: 'degree',
        }));

      return normalizedRecords.sort((first, second) => {
        if (first.elapsedMs !== second.elapsedMs) {
          return first.elapsedMs - second.elapsedMs;
        }
        return first.totalGuesses - second.totalGuesses;
      });
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  private stopTimer() {
    if (!this.timerIntervalId) {
      return;
    }

    clearInterval(this.timerIntervalId);
    this.timerIntervalId = undefined;
  }

  private generateNewChordAndDegree() {
    let newChord = PlayDegreeComponent.generateRandomChord();
    while (
      newChord.baseNote === this.currentChord().baseNote &&
      newChord.type === this.currentChord().type
    ) {
      newChord = PlayDegreeComponent.generateRandomChord();
    }

    this.currentChord.set(newChord);

    // Sempre aggiorna lo scale in base al playMode
    if (this.playMode() === 'major') {
      this.currentScale.set(ScaleType.Ionian);
    } else if (this.playMode() === 'modes') {
      this.currentScale.set(this.getRandomMode());
    } else {
      // playMode === 'chord'
      this.currentScale.set(ScaleType.Ionian);
    }

    this.currentDegree.set(this.getRandomDegree());
  }

  private getRandomDegree(): ChordDegree {
    const availableDegrees = this.playMode() === 'chord' ? CHORD_AVAILABLE_DEGREES : SCALE_AVAILABLE_DEGREES;
    const randomIndex = Math.floor(Math.random() * availableDegrees.length);
    return availableDegrees[randomIndex];
  }

  private getRandomMode(): ScaleType {
    const modes = getModes();
    const randomIndex = Math.floor(Math.random() * modes.length);
    return modes[randomIndex];
  }

  private playSound(status: number, noteId: number, velocity: number) {
    if (!this.sampler) {
      return;
    }

    const command = status & 0xf0;
    const noteName = Tone.Frequency(noteId, 'midi').toNote();

    if (command === 0x90 && velocity > 0) {
      this.sampler.triggerAttack(noteName, Tone.now(), velocity / 127);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.sampler.triggerRelease(noteName, Tone.now());
    }
  }

  private getInterval(baseNote: Note, arrivalNote: Note): Interval {
    if (arrivalNote.type >= baseNote.type) {
      return arrivalNote.type - baseNote.type;
    } else {
      return arrivalNote.type + 12 - baseNote.type;
    }
  }

  private needCheckDegree(): boolean {
    // Solo una nota deve essere premuta
    if (this.keyboardService.pressedNotes().length !== 1) {
      return false;
    }

    if (this.lastMidiEventType !== MidiEventType.Pressed) {
      return false;
    }

    return true;
  }

  private checkDegree(): boolean {
    const pressedNotes = this.keyboardService.pressedNotes();
    if (pressedNotes.length !== 1) {
      return false;
    }

    const baseNote = new Note(this.currentChord().baseNote);
    const playedNote = pressedNotes[0];
    const playedInterval = this.getInterval(baseNote, playedNote);

    let expectedInterval: Interval;

    // Per la modalità accordo, il 3 e 7 variano in base al tipo di accordo
    if (this.playMode() === 'chord' && this.currentDegree() === ChordDegree.Three) {
      // 3 senza specifica: maggiore per accordi maggiori (7, Maj7), minore per accordi minori (-7)
      if (this.currentChord().type === ChordType.Minor7) {
        expectedInterval = Interval.IIIm; // terza minore
      } else {
        expectedInterval = Interval.IIIM; // terza maggiore
      }
    } else if (this.playMode() === 'chord' && this.currentDegree() === ChordDegree.Seven) {
      // 7 senza specifica: minore per accordi -7 e 7, maggiore per Maj7
      if (this.currentChord().type === ChordType.Major7) {
        expectedInterval = Interval.VIIM; // settima maggiore
      } else {
        expectedInterval = Interval.VIIm; // settima minore
      }
    } else {
      // Usa il mapping standard per tutti gli altri gradi
      expectedInterval = degreeToDegreeLabel[this.currentDegree()];
    }

    return playedInterval === expectedInterval;
  }

  static generateRandomChord(): ChordDefinition {
    const baseNote = PlayDegreeComponent.getRandomEnumValue(NoteType) as NoteType;

    return {
      baseNote,
      type: PlayDegreeComponent.getRandomEnumValue(ChordType),
      displayBaseNote: getNoteLabel(baseNote, 'random'),
    };
  }

  static getRandomScale(): ScaleType {
    return PlayDegreeComponent.getRandomEnumValue(ScaleType) as ScaleType;
  }

  static getRandomEnumValue = (enumeration: any) => {
    const values = Object.keys(enumeration)
      .filter((k) => !isNaN(Number(k)))
      .map((k) => Number(k));

    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
  };
}
