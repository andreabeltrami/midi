import { Component, OnDestroy, signal } from '@angular/core';
import { ChordType } from '../../enums/chord-type';
import { Interval } from '../../enums/interval';
import { getNoteLabel, getNoteOptions, NoteType } from '../../enums/note-type';
import { getVoicingLabelKey, VoicingStyle } from '../../enums/voicing-style';
import { ChordDefinition } from '../../types/chord-definition';
import { Note } from '../../types/note';
import { PlayChordComponent } from '../play-chord/play-chord.component';
import { KeyboardComponentComponent } from '../keyboard-component/keyboard-component.component';
import { KeyboardService } from '../../services/keyboard.service';
import * as Tone from 'tone';
import { getChordVoicingIntervals } from '../../config/chord-voicings';
import { GameRunRecord, GuessAttempt, InputSource } from '../../types/game-run-record';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { VoicingInfoComponent } from '../voicing-info/voicing-info.component';
import { ResultsStoreService } from '../../services/results-store.service';
import {
  formatElapsedMs,
  getChordLabel,
  loadGameRunsFromStorage,
  saveGameRunsToStorage,
  sortGameRuns,
} from '../../utils/game-run.utils';

@Component({
  selector: 'app-recognize-chord',
  imports: [KeyboardComponentComponent, TranslatePipe, VoicingInfoComponent],
  templateUrl: './recognize-chord.component.html',
  styleUrl: './recognize-chord.component.css',
})
export class RecognizeChordComponent implements OnDestroy {
  private static readonly LEADERBOARD_STORAGE_KEY = 'recognize-chord-leaderboard-v1';
  private static readonly TARGET_STREAK = 5;

  readonly voicingOptions = Object.values(VoicingStyle);
  protected readonly getVoicingLabelKey = getVoicingLabelKey;

  readonly noteOptions = getNoteOptions();

  readonly chordTypeOptions = [
    { label: '-7', value: ChordType.Minor7 },
    { label: '7', value: ChordType.Perfect7 },
    { label: 'Maj7', value: ChordType.Major7 },
    { label: '°7', value: ChordType.Diminished7 },
     { label: 'ø7', value: ChordType.HalfDiminished7 },
  ];

  currentChord = signal<ChordDefinition>(PlayChordComponent.generateRandomChord());
  currentChordWrong = signal(false);
  currentChordCorrect = signal(false);
  voicingStyle = signal<VoicingStyle>(VoicingStyle.Rootless);
  showVoicingInfo = signal(false);

  gameActive = signal(false);
  currentStreak = signal(0);
  totalGuesses = signal(0);
  wrongGuesses = signal(0);
  elapsedSeconds = signal(0);
  currentGuessElapsedMs = signal(0);
  leaderboard = signal<GameRunRecord[]>([]);
  latestResult = signal<GameRunRecord | null>(null);

  selectedBaseNote = signal<NoteType>(NoteType.C);
  selectedChordType = signal<ChordType>(ChordType.Minor7);
  private sampler?: Tone.Sampler;
  private gameStartTimestamp = 0;
  private timerIntervalId?: ReturnType<typeof setInterval>;
  private currentRunGuessedChords: string[] = [];
  private currentRunAttempts: GuessAttempt[] = [];
  private currentTargetWrongGuesses = 0;
  private targetStartTimestamp = 0;

  constructor(
    protected keyboardService: KeyboardService,
    private readonly resultsStore: ResultsStoreService,
  ) {
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
    return formatElapsedMs(seconds * 1000);
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
    this.currentRunAttempts = [];
    this.currentTargetWrongGuesses = 0;
    this.gameActive.set(true);

    this.stopTimer();
    this.gameStartTimestamp = Date.now();
    this.timerIntervalId = setInterval(() => {
      this.elapsedSeconds.set(Math.floor((Date.now() - this.gameStartTimestamp) / 1000));
      this.currentGuessElapsedMs.set(Date.now() - this.targetStartTimestamp);
    }, 250);

    this.generateNewChord();
    this.drawChord();
    this.startTargetTimer();
  }

  public abortChallenge() {
    this.gameActive.set(false);
    this.currentStreak.set(0);
    this.totalGuesses.set(0);
    this.wrongGuesses.set(0);
    this.elapsedSeconds.set(0);
    this.currentGuessElapsedMs.set(0);
    this.currentRunGuessedChords = [];
    this.currentRunAttempts = [];
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

  public toggleVoicingInfo() {
    this.showVoicingInfo.update((value) => !value);
  }

  public hideVoicingInfo() {
    this.showVoicingInfo.set(false);
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
        this.recordSuccessfulAttempt(getChordLabel(this.currentChord()), 'manual');
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
        this.startTargetTimer();
      }, 500);
      return;
    }

    this.currentChordWrong.set(true);
    if (this.gameActive()) {
      this.wrongGuesses.update((value) => value + 1);
      this.currentStreak.set(0);
      this.currentTargetWrongGuesses += 1;
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
      attempts: [...this.currentRunAttempts],
      inputSource: 'manual',
      gameType: 'recognize',
    };

    this.latestResult.set(newRecord);
    this.gameActive.set(false);
    this.stopTimer();

    const updatedBoard = sortGameRuns([...this.leaderboard(), newRecord]);

    this.leaderboard.set(updatedBoard);
    this.persistLeaderboard(updatedBoard);
    void this.resultsStore.save(newRecord).catch((error) => console.error(error));
  }

  private persistLeaderboard(records: GameRunRecord[]) {
    try {
      saveGameRunsToStorage(RecognizeChordComponent.LEADERBOARD_STORAGE_KEY, records);
    } catch (error) {
      console.error(error);
    }
  }

  private loadLeaderboard() {
    try {
      this.leaderboard.set(loadGameRunsFromStorage(RecognizeChordComponent.LEADERBOARD_STORAGE_KEY, 'recognize'));
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

  private startTargetTimer() {
    this.targetStartTimestamp = Date.now();
    this.currentGuessElapsedMs.set(0);
    this.currentTargetWrongGuesses = 0;
  }

  private recordSuccessfulAttempt(target: string, inputSource: Exclude<InputSource, 'mixed' | 'unknown'>) {
    const elapsedMs = Date.now() - this.targetStartTimestamp;
    this.currentRunGuessedChords.push(target);
    this.currentRunAttempts.push({
      target,
      elapsedMs,
      wrongGuesses: this.currentTargetWrongGuesses,
      inputSource,
    });
    this.currentGuessElapsedMs.set(elapsedMs);
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
