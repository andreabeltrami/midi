import { Component, computed, signal } from '@angular/core';
import { GameRunRecord } from '../../types/game-run-record';

type SortField = 'completedAtIso' | 'elapsedMs' | 'totalGuesses' | 'wrongGuesses' | 'voicingStyle';
type SortDirection = 'asc' | 'desc';

const LEADERBOARD_KEY = 'recognize-chord-leaderboard-v1';

@Component({
  selector: 'app-recognize-results-table',
  templateUrl: './recognize-results-table.component.html',
  styleUrl: './recognize-results-table.component.css',
})
export class RecognizeResultsTableComponent {
  readonly records = signal<GameRunRecord[]>(this.loadFromStorage());

  private loadFromStorage(): GameRunRecord[] {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as GameRunRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (e) =>
            typeof e.id === 'string' &&
            typeof e.completedAtIso === 'string' &&
            typeof e.elapsedMs === 'number' &&
            typeof e.totalGuesses === 'number' &&
            typeof e.wrongGuesses === 'number' &&
            Array.isArray(e.guessedChords),
        )
        .map((e) => ({ ...e, voicingStyle: typeof e.voicingStyle === 'string' ? e.voicingStyle : 'Unknown' }))
        .sort((a, b) => (a.elapsedMs !== b.elapsedMs ? a.elapsedMs - b.elapsedMs : a.totalGuesses - b.totalGuesses));
    } catch {
      return [];
    }
  }

  readonly searchTerm = signal('');
  readonly selectedVoicing = signal<string>('all');
  readonly sortField = signal<SortField>('elapsedMs');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly voicingOptions = computed(() => {
    const options = new Set(this.records().map((record) => record.voicingStyle));
    return ['all', ...Array.from(options)];
  });

  readonly filteredRecords = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const voicing = this.selectedVoicing();

    const filtered = this.records().filter((record) => {
      const matchVoicing = voicing === 'all' || record.voicingStyle === voicing;
      const matchTerm =
        term.length === 0 ||
        record.guessedChords.some((chord) => chord.toLowerCase().includes(term)) ||
        this.getReadableDate(record.completedAtIso).toLowerCase().includes(term);

      return matchVoicing && matchTerm;
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
    return new Date(isoDate).toLocaleString('it-IT');
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
        return record.voicingStyle;
    }
  }
}
