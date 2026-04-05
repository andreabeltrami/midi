import { Component, OnDestroy, signal } from '@angular/core';
import { ChordType } from '../../enums/chord-type';
import { Interval } from '../../enums/interval';
import { getNoteLabel, getNoteOptions, NoteType } from '../../enums/note-type';
import { VoicingStyle } from '../../enums/voicing-style';
import { ChordDefinition } from '../../types/chord-definition';
import { Note } from '../../types/note';
import { PlayChordComponent } from '../play-chord/play-chord.component';
import { KeyboardComponentComponent } from '../keyboard-component/keyboard-component.component';
import { KeyboardService } from '../../services/keyboard.service';
import * as Tone from 'tone';
import { getChordVoicingIntervals } from '../../config/chord-voicings';
import { GameRunRecord } from '../../types/game-run-record';

@Component({
  selector: 'app-recognize-chord',
  imports: [KeyboardComponentComponent],
  templateUrl: './recognize-chord.component.html',
  styleUrl: './recognize-chord.component.css',
})
export class RecognizeChordComponent implements OnDestroy {
  private static readonly LEADERBOARD_STORAGE_KEY = 'recognize-chord-leaderboard-v1';
  private static readonly TARGET_STREAK = 5;

  readonly voicingOptions = Object.values(VoicingStyle);

  readonly noteOptions = getNoteOptions();

  readonly chordTypeOptions = [
    { label: '-7', value: ChordType.Minor7 },
    { label: '7', value: ChordType.Perfect7 },
    { label: 'Maj7', value: ChordType.Major7 },
  ];

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

  selectedBaseNote = signal<NoteType>(NoteType.C);
  selectedChordType = signal<ChordType>(ChordType.Minor7);
  private sampler?: Tone.Sampler;
  private gameStartTimestamp = 0;
  private timerIntervalId?: ReturnType<typeof setInterval>;
  private currentRunGuessedChords: string[] = [];

  constructor(protected keyboardService: KeyboardService) {
    this.drawChord();
    this.initializeToneSampler();
    this.loadLeaderboard();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  public get targetStreak() {
    return RecognizeChordComponent.TARGET_STREAK;
  }

  public get canShowLeaderboard() {
    return this.leaderboard().length > 0;
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

  public getReadableDate(isoDate: string): string {
    return new Date(isoDate).toLocaleString('it-IT');
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

    this.generateNewChord();
    this.drawChord();
  }

  public abortChallenge() {
    this.gameActive.set(false);
    this.currentStreak.set(0);
    this.totalGuesses.set(0);
    this.wrongGuesses.set(0);
    this.elapsedSeconds.set(0);
    this.currentRunGuessedChords = [];
    this.stopTimer();
  }

  public changeChord() {
    this.generateNewChord();
    this.drawChord();
    this.clearFeedback();
  }

  public onVoicingChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as VoicingStyle;
    this.voicingStyle.set(value);
    this.drawChord();
  }

  public onBaseNoteChange(event: Event) {
    this.selectedBaseNote.set(Number((event.target as HTMLSelectElement).value) as NoteType);
  }

  public onChordTypeChange(event: Event) {
    this.selectedChordType.set(Number((event.target as HTMLSelectElement).value) as ChordType);
  }

  public submitGuess() {
    const matches =
      this.selectedBaseNote() === this.currentChord().baseNote &&
      this.selectedChordType() === this.currentChord().type;

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
        this.gameActive() && this.currentStreak() >= RecognizeChordComponent.TARGET_STREAK;

      if (completedChallenge) {
        this.finishChallenge();
        setTimeout(() => this.currentChordCorrect.set(false), 500);
        return;
      }

      setTimeout(() => {
        this.currentChordCorrect.set(false);
        this.generateNewChord();
        this.drawChord();
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

  public async playCurrentChordPreview() {
    if (this.keyboardService.pressedNotes().length === 0) {
      this.drawChord();
    }

    await Tone.start();
    if (!this.sampler) {
      return;
    }

    const noteNames = this.keyboardService
      .pressedNotes()
      .map((note) => Tone.Frequency(note.originalNumber, 'midi').toNote());

    this.sampler.triggerAttackRelease(noteNames, '1n', Tone.now());
  }

  private initializeToneSampler() {
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
    } catch (e) {
      console.error(e);
    }
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
      gameType: 'recognize',
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
      localStorage.setItem(
        RecognizeChordComponent.LEADERBOARD_STORAGE_KEY,
        JSON.stringify(records),
      );
    } catch (error) {
      console.error(error);
    }
  }

  private loadLeaderboard() {
    try {
      const rawValue = localStorage.getItem(RecognizeChordComponent.LEADERBOARD_STORAGE_KEY);
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
          gameType: entry.gameType === 'play' ? 'play' : 'recognize',
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

  private drawChord() {
    let defaultAdder = 48;
    const chord = this.currentChord();
    const intervals = this.getIntervalsArray(chord.type);

    const notes: Note[] = [];
    const start = this.voicingStyle() === VoicingStyle.Base ? 0 : Math.random() < 0.5 ? 1 : 3;

    for (let i = 0; i < intervals.length; i++) {
      const index = (start + i) % intervals.length;
      notes.push(new Note(chord.baseNote + intervals[index] + defaultAdder));
      if (index === intervals.length - 1) {
        defaultAdder += 12;
      }
    }

    this.keyboardService.pressedNotes.set(notes);
  }

  private getIntervalsArray(chordType: ChordType): Interval[] {
    const intervals = getChordVoicingIntervals(chordType, this.voicingStyle());
    return intervals ? [...intervals] : [];
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
}
