import { Component, computed, inject, signal } from '@angular/core';
import { getVoicingLabelKey } from '../../enums/voicing-style';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { GameRunRecord, TrainerGameType } from '../../types/game-run-record';

type SortField =
  | 'completedAtIso'
  | 'elapsedMs'
  | 'totalGuesses'
  | 'wrongGuesses'
  | 'voicingStyle'
  | 'gameType';
type SortDirection = 'asc' | 'desc';
type ResultsTab = 'all' | TrainerGameType;

const STORAGE_KEYS: Record<TrainerGameType, string> = {
  play: 'play-chord-leaderboard-v1',
  recognize: 'recognize-chord-leaderboard-v1',
  degree: 'play-degree-leaderboard-v1',
};

@Component({
  selector: 'app-result-table',
  imports: [TranslatePipe],
  templateUrl: './result-table.component.html',
  styleUrl: './result-table.component.css',
})
export class ResultTableComponent {
  private readonly i18n = inject(I18nService);

  readonly records = signal<GameRunRecord[]>(this.loadFromStorage());
  readonly searchTerm = signal('');
  readonly selectedVoicing = signal<string>('all');
  readonly selectedTab = signal<ResultsTab>('all');
  readonly sortField = signal<SortField>('elapsedMs');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly getVoicingLabelKey = getVoicingLabelKey;

  readonly tabs: { labelKey: string; value: ResultsTab }[] = [
    { labelKey: 'common.all', value: 'all' },
    { labelKey: 'app.modes.playTitle', value: 'play' },
    { labelKey: 'app.modes.recognizeTitle', value: 'recognize' },
  ];

  readonly voicingOptions = computed(() => {
    const options = new Set(this.records().map((record) => record.voicingStyle));
    return ['all', ...Array.from(options)];
  });

  readonly filteredRecords = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const voicing = this.selectedVoicing();
    const tab = this.selectedTab();

    const filtered = this.records().filter((record) => {
      const matchVoicing = voicing === 'all' || record.voicingStyle === voicing;
      const matchTab = tab === 'all' || record.gameType === tab;
      const matchTerm =
        term.length === 0 ||
        record.guessedChords.some((chord) => chord.toLowerCase().includes(term)) ||
        this.getReadableDate(record.completedAtIso).toLowerCase().includes(term) ||
        this.getGameLabel(record.gameType).toLowerCase().includes(term);

      return matchVoicing && matchTab && matchTerm;
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

  setSearchTerm(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setVoicingFilter(event: Event) {
    this.selectedVoicing.set((event.target as HTMLSelectElement).value);
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
    return this.i18n.t(gameType === 'play' ? 'app.modes.playTitle' : 'app.modes.recognizeTitle');
  }

  private loadFromStorage(): GameRunRecord[] {
    try {
      return (Object.entries(STORAGE_KEYS) as [TrainerGameType, string][])
        .flatMap(([gameType, storageKey]) => this.loadBoard(storageKey, gameType))
        .sort((a, b) => (a.elapsedMs !== b.elapsedMs ? a.elapsedMs - b.elapsedMs : a.totalGuesses - b.totalGuesses));
    } catch {
      return [];
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
        gameType: entry.gameType === 'play' || entry.gameType === 'recognize' ? entry.gameType : gameType,
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
