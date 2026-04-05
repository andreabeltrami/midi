import { Component, computed, OnDestroy, signal } from '@angular/core';
import { ChordDefinition } from '../../types/chord-definition';
import { Note } from '../../types/note';
import { VoicingStyle } from '../../enums/voicing-style';
import { ChordType } from '../../enums/chord-type';
import { getNoteLabel, NoteType } from '../../enums/note-type';
import { Interval } from '../../enums/interval';
import { MidiEventType } from '../../enums/midi-event-type';
import { PianoKey } from '../../types/piano-key';
import * as Tone from 'tone';
import { KeyboardService } from '../../services/keyboard.service';
import { KeyboardComponentComponent } from '../keyboard-component/keyboard-component.component';
import { getChordVoicingIntervals } from '../../config/chord-voicings';
import { GameRunRecord } from '../../types/game-run-record';

@Component({
  selector: 'app-play-chord',
  imports: [KeyboardComponentComponent],
  templateUrl: './play-chord.component.html',
  styleUrl: './play-chord.component.css',
})
export class PlayChordComponent implements OnDestroy {
  private static readonly LEADERBOARD_STORAGE_KEY = 'play-chord-leaderboard-v1';
  private static readonly TARGET_STREAK = 5;

  readonly voicingOptions = Object.values(VoicingStyle);

  currentChord = signal<ChordDefinition>(PlayChordComponent.generateRandomChord());
  currentChordWrong = signal(false);
  currentChordCorrect = signal(false);
  voicingStyle = signal<VoicingStyle>(VoicingStyle.Standard);

  gameActive = signal(false);
  currentStreak = signal(0);
  totalGuesses = signal(0);
  wrongGuesses = signal(0);
  elapsedSeconds = signal(0);
  leaderboard = signal<GameRunRecord[]>([]);
  latestResult = signal<GameRunRecord | null>(null);

  currentChordString = computed(() => {
    const chord = this.currentChord();
    if (!chord) return '';

    const qualityByChordType: Record<ChordType, string> = {
      [ChordType.Minor7]: '-7',
      [ChordType.Perfect7]: '7',
      [ChordType.Major7]: 'Maj7',
    };

    const baseNoteLabel = chord.displayBaseNote ?? getNoteLabel(chord.baseNote);
    return `${baseNoteLabel}${qualityByChordType[chord.type] ?? ''}`;
  });

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
    this.loadLeaderboard();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  public get targetStreak() {
    return PlayChordComponent.TARGET_STREAK;
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
    this.generateNewChord();
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

  public onVoicingChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as VoicingStyle;
    this.voicingStyle.set(value);
    this.clearFeedback();
    this.resetPressedNotes();
  }

  public resetPressedNotes() {
    [...this.keyboardService.pressedNotes()].forEach((note) => {
      this.handleNote(MidiEventType.Released, note.originalNumber, 127);
    });
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

    if (this.needCheckChord()) {
      this.processGuess(this.checkChord());
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
        this.currentRunGuessedChords.push(this.getChordLabel(this.currentChord()));
      }

      this.currentChordCorrect.set(true);

      const completedChallenge =
        this.gameActive() && this.currentStreak() >= PlayChordComponent.TARGET_STREAK;

      if (completedChallenge) {
        this.finishChallenge();
        setTimeout(() => this.currentChordCorrect.set(false), 500);
        return;
      }

      setTimeout(() => {
        this.currentChordCorrect.set(false);
        this.resetPressedNotes();
        this.generateNewChord();
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
    const newRecord: GameRunRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      completedAtIso: new Date().toISOString(),
      elapsedMs,
      totalGuesses: this.totalGuesses(),
      wrongGuesses: this.wrongGuesses(),
      voicingStyle: this.voicingStyle(),
      guessedChords: [...this.currentRunGuessedChords],
      gameType: 'play',
    };

    this.latestResult.set(newRecord);
    this.gameActive.set(false);
    this.stopTimer();

    const updatedBoard = [...this.leaderboard(), newRecord].sort((first, second) => {
      if (first.elapsedMs !== second.elapsedMs) {
        return first.elapsedMs - second.elapsedMs;
      }
      return first.totalGuesses - second.totalGuesses;
    });

    this.leaderboard.set(updatedBoard);
    this.persistLeaderboard(updatedBoard);
  }

  private getChordLabel(chord: ChordDefinition): string {
    const noteName = chord.displayBaseNote ?? getNoteLabel(chord.baseNote);
    const qualityByChordType: Record<ChordType, string> = {
      [ChordType.Minor7]: '-7',
      [ChordType.Perfect7]: '7',
      [ChordType.Major7]: 'Maj7',
    };
    const quality = qualityByChordType[chord.type] ?? '?';
    return `${noteName}${quality}`;
  }

  private persistLeaderboard(records: GameRunRecord[]) {
    try {
      localStorage.setItem(PlayChordComponent.LEADERBOARD_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error(error);
    }
  }

  private loadLeaderboard() {
    try {
      const rawValue = localStorage.getItem(PlayChordComponent.LEADERBOARD_STORAGE_KEY);
      if (!rawValue) {
        return;
      }

      const parsedValue = JSON.parse(rawValue) as GameRunRecord[];
      if (!Array.isArray(parsedValue)) {
        return;
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
          gameType: entry.gameType === 'recognize' ? 'recognize' : 'play',
        }));

      this.leaderboard.set(
        normalizedRecords.sort((first, second) => {
          if (first.elapsedMs !== second.elapsedMs) {
            return first.elapsedMs - second.elapsedMs;
          }
          return first.totalGuesses - second.totalGuesses;
        }),
      );
    } catch (error) {
      console.error(error);
    }
  }

  private stopTimer() {
    if (!this.timerIntervalId) {
      return;
    }

    clearInterval(this.timerIntervalId);
    this.timerIntervalId = undefined;
  }

  private generateNewChord() {
    let newChord = PlayChordComponent.generateRandomChord();
    while (
      newChord.baseNote === this.currentChord().baseNote &&
      newChord.type === this.currentChord().type
    ) {
      newChord = PlayChordComponent.generateRandomChord();
    }

    this.currentChord.set(newChord);
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

  private needCheckChord(): boolean {
    if (this.keyboardService.pressedNotes().length !== 4) {
      return false;
    }

    if (this.lastMidiEventType !== MidiEventType.Pressed) {
      return false;
    }

    return true;
  }

  private checkChord(): boolean {
    const baseNote = new Note(this.currentChord().baseNote);
    const playedIntervals: Interval[] = this.keyboardService
      .pressedNotes()
      .map((x) => this.getInterval(baseNote, x));
    const expectedIntervals = getChordVoicingIntervals(this.currentChord().type, this.voicingStyle());

    if (!expectedIntervals) {
      return false;
    }

    return this.serializeIntervals(playedIntervals) === this.serializeIntervals(expectedIntervals);
  }

  private serializeIntervals(intervals: readonly Interval[]): string {
    return [...intervals].sort((a, b) => a - b).join(',');
  }

  static generateRandomChord(): ChordDefinition {
    const baseNote = PlayChordComponent.getRandomEnumValue(NoteType) as NoteType;

    return {
      baseNote,
      type: PlayChordComponent.getRandomEnumValue(ChordType),
      displayBaseNote: getNoteLabel(baseNote, 'random'),
    };
  }

  static getRandomEnumValue = (enumeration: any) => {
    const values = Object.keys(enumeration)
      .filter((k) => !isNaN(Number(k)))
      .map((k) => Number(k));

    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
  };
}

