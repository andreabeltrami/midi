import { Component, computed, effect, inject, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import { getVoicingLabelKey } from '../../enums/voicing-style';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { GameRunRecord, GuessAttempt, InputSource, TrainerGameType } from '../../types/game-run-record';
import { ResultsStoreService } from '../../services/results-store.service';
import { AuthService } from '../../services/auth.service';

type SortField =
  | 'completedAtIso'
  | 'elapsedMs'
  | 'totalGuesses'
  | 'wrongGuesses'
  | 'voicingStyle'
  | 'gameType';
type SortDirection = 'asc' | 'desc';
type ResultsTab = 'all' | TrainerGameType;
type DifficultySortField = 'averageTime' | 'wrongGuesses' | 'attempts';

interface DifficultyStat {
  key: string;
  target: string;
  gameType: TrainerGameType;
  inputSource: InputSource;
  attempts: number;
  averageTimeMs: number;
  wrongGuesses: number;
}

const STORAGE_KEYS: [TrainerGameType, string][] = [
  ['play', 'play-chord-leaderboard-v1'],
  ['recognize', 'recognize-chord-leaderboard-v1'],
  ['degree', 'play-degree-chord-leaderboard-v1'],
  ['degree', 'play-degree-major-leaderboard-v1'],
  ['degree', 'play-degree-modes-leaderboard-v1'],
];

@Component({
  selector: 'app-result-table',
  imports: [TranslatePipe],
  templateUrl: './result-table.component.html',
  styleUrl: './result-table.component.css',
})
export class ResultTableComponent {
  private readonly i18n = inject(I18nService);
  private readonly resultsStore = inject(ResultsStoreService);
  private readonly auth = inject(AuthService);

  readonly records = signal<GameRunRecord[]>(this.loadFromStorage());
  readonly searchTerm = signal('');
  readonly selectedVoicing = signal<string>('all');
  readonly selectedInputSource = signal<InputSource | 'all'>('all');
  readonly selectedTab = signal<ResultsTab>('all');
  readonly sortField = signal<SortField>('elapsedMs');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly difficultySortField = signal<DifficultySortField>('averageTime');
  readonly difficultySortDirection = signal<SortDirection>('desc');
  readonly getVoicingLabelKey = getVoicingLabelKey;

  readonly tabs: { labelKey: string; value: ResultsTab }[] = [
    { labelKey: 'common.all', value: 'all' },
    { labelKey: 'app.modes.playTitle', value: 'play' },
    { labelKey: 'app.modes.recognizeTitle', value: 'recognize' },
    { labelKey: 'app.modes.degreeTitle', value: 'degree' },
  ];

  readonly voicingOptions = computed(() => {
    const options = new Set(this.records().map((record) => record.voicingStyle));
    return ['all', ...Array.from(options)];
  });

  readonly inputSourceOptions: (InputSource | 'all')[] = ['all', 'midi', 'manual', 'mixed', 'unknown'];

  constructor() {
    effect(() => {
      void this.loadRecordsForUser(this.auth.user());
    });
  }

  readonly filteredRecords = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const voicing = this.selectedVoicing();
    const inputSource = this.selectedInputSource();
    const tab = this.selectedTab();

    const filtered = this.records().filter((record) => {
      const matchVoicing = voicing === 'all' || record.voicingStyle === voicing;
      const matchInputSource = inputSource === 'all' || record.inputSource === inputSource;
      const matchTab = tab === 'all' || record.gameType === tab;
      const matchTerm =
        term.length === 0 ||
        record.guessedChords.some((chord) => chord.toLowerCase().includes(term)) ||
        this.getReadableDate(record.completedAtIso).toLowerCase().includes(term) ||
        this.getGameLabel(record.gameType).toLowerCase().includes(term);

      return matchVoicing && matchInputSource && matchTab && matchTerm;
    });

    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((first, second) => {
      const left = this.getSortValue(first, field);
      const right = this.getSortValue(second, field);

      if (left < right) {
        return -1 * direction;
      }
      if (left > right) {
        return 1 * direction;
      }
      return 0;
    });
  });

  readonly difficultyStats = computed(() => {
      const aggregate = new Map<string, DifficultyStat>();

      for (const record of this.filteredRecords()) {
        for (const attempt of record.attempts) {
          const key = `${record.gameType}:${attempt.inputSource}:${attempt.target}`;
          const current = aggregate.get(key) ?? {
            key,
            target: attempt.target,
            gameType: record.gameType,
            inputSource: attempt.inputSource,
            attempts: 0,
            averageTimeMs: 0,
            wrongGuesses: 0,
          };
          current.averageTimeMs += attempt.elapsedMs;
          current.attempts += 1;
          current.wrongGuesses += attempt.wrongGuesses;
          aggregate.set(key, current);
        }
      }

      const field = this.difficultySortField();
      const direction = this.difficultySortDirection() === 'asc' ? 1 : -1;

      return Array.from(aggregate.values())
        .map((stat) => ({ ...stat, averageTimeMs: stat.averageTimeMs / stat.attempts }))
        .sort((first, second) => {
          const left = field === 'averageTime' ? first.averageTimeMs : field === 'wrongGuesses' ? first.wrongGuesses : first.attempts;
          const right = field === 'averageTime' ? second.averageTimeMs : field === 'wrongGuesses' ? second.wrongGuesses : second.attempts;
          return (left - right) * direction;
        });
    });

  setSearchTerm(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setVoicingFilter(event: Event) {
    this.selectedVoicing.set((event.target as HTMLSelectElement).value);
  }

  setInputSourceFilter(event: Event) {
    this.selectedInputSource.set((event.target as HTMLSelectElement).value as InputSource | 'all');
  }

  setSortField(event: Event) {
    this.sortField.set((event.target as HTMLSelectElement).value as SortField);
  }

  setTab(tab: ResultsTab) {
    this.selectedTab.set(tab);
  }

  toggleSortDirection() {
    this.sortDirection.update((current) => (current === 'asc' ? 'desc' : 'asc'));
  }

  setDifficultySortField(event: Event) {
    this.difficultySortField.set((event.target as HTMLSelectElement).value as DifficultySortField);
  }

  toggleDifficultySortDirection() {
    this.difficultySortDirection.update((current) => (current === 'asc' ? 'desc' : 'asc'));
  }

  getElapsedLabelFromMs(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  getReadableDate(isoDate: string): string {
    return new Date(isoDate).toLocaleString(this.i18n.getLocale());
  }

  getGameLabel(gameType: TrainerGameType): string {
    const keyByGameType: Record<TrainerGameType, string> = {
      play: 'app.modes.playTitle',
      recognize: 'app.modes.recognizeTitle',
      degree: 'app.modes.degreeTitle',
    };
    return this.i18n.t(keyByGameType[gameType]);
  }

  getInputSourceLabel(source: InputSource | 'all'): string {
    const keyBySource: Record<InputSource | 'all', string> = {
      all: 'common.all',
      midi: 'results.inputSources.midi',
      manual: 'results.inputSources.manual',
      mixed: 'results.inputSources.mixed',
      unknown: 'results.inputSources.unknown',
    };
    return this.i18n.t(keyBySource[source]);
  }

  private loadFromStorage(): GameRunRecord[] {
    try {
      return STORAGE_KEYS.flatMap(([gameType, storageKey]) => this.loadBoard(storageKey, gameType))
        .sort((a, b) => (a.elapsedMs !== b.elapsedMs ? a.elapsedMs - b.elapsedMs : a.totalGuesses - b.totalGuesses));
    } catch {
      return [];
    }
  }

  private async loadRecordsForUser(user: User | null): Promise<void> {
    if (!user) {
      this.records.set(this.loadFromStorage());
      return;
    }

    try {
      const remoteRecords = (await this.resultsStore.load()).map((record) => {
        const inputSource: InputSource =
          record.inputSource === 'midi' || record.inputSource === 'manual' || record.inputSource === 'mixed'
            ? record.inputSource
            : 'unknown';

        return {
          ...record,
          guessedChords: Array.isArray(record.guessedChords) ? record.guessedChords : [],
          attempts: this.normalizeAttempts(record.attempts, inputSource),
          inputSource,
        };
      });
      this.records.set(remoteRecords.sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso)));
    } catch (error) {
      console.error(error);
    }
  }

  private loadBoard(storageKey: string, gameType: TrainerGameType): GameRunRecord[] {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Partial<GameRunRecord>[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
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
        id: entry.id as string,
        completedAtIso: entry.completedAtIso as string,
        elapsedMs: entry.elapsedMs as number,
        totalGuesses: entry.totalGuesses as number,
        wrongGuesses: entry.wrongGuesses as number,
        voicingStyle: typeof entry.voicingStyle === 'string' ? entry.voicingStyle : 'Unknown',
        guessedChords: [...(entry.guessedChords as string[])],
        attempts: this.normalizeAttempts(entry.attempts, typeof entry.inputSource === 'string' ? entry.inputSource as InputSource : 'unknown'),
        inputSource: entry.inputSource === 'midi' || entry.inputSource === 'manual' || entry.inputSource === 'mixed'
          ? entry.inputSource
          : 'unknown',
        gameType: entry.gameType === 'play' || entry.gameType === 'recognize' ? entry.gameType : gameType,
      }));
  }

  private normalizeAttempts(value: unknown, fallbackSource: InputSource): GuessAttempt[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (attempt): attempt is GuessAttempt =>
        !!attempt &&
        typeof attempt === 'object' &&
        typeof (attempt as GuessAttempt).target === 'string' &&
        typeof (attempt as GuessAttempt).elapsedMs === 'number' &&
        typeof (attempt as GuessAttempt).wrongGuesses === 'number',
    ).map((attempt) => ({
      ...attempt,
      inputSource: attempt.inputSource === 'midi' || attempt.inputSource === 'manual' || attempt.inputSource === 'mixed' || attempt.inputSource === 'unknown'
        ? attempt.inputSource
        : fallbackSource,
    }));
  }

  private getSortValue(record: GameRunRecord, field: SortField): number | string {
    switch (field) {
      case 'completedAtIso':
        return new Date(record.completedAtIso).getTime();
      case 'elapsedMs':
        return record.elapsedMs;
      case 'totalGuesses':
        return record.totalGuesses;
      case 'wrongGuesses':
        return record.wrongGuesses;
      case 'voicingStyle':
        return this.i18n.t(getVoicingLabelKey(record.voicingStyle));
      case 'gameType':
        return this.getGameLabel(record.gameType);
    }
  }
}
