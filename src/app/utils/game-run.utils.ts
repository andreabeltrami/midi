import { ChordType } from '../enums/chord-type';
import { getNoteLabel } from '../enums/note-type';
import { ChordDefinition } from '../types/chord-definition';
import { GameRunRecord, GuessAttempt, InputSource, TrainerGameType } from '../types/game-run-record';

const CHORD_QUALITY_LABELS: Record<ChordType, string> = {
  [ChordType.Minor7]: '-7',
  [ChordType.Perfect7]: '7',
  [ChordType.Major7]: 'Maj7',
  [ChordType.Diminished7]: '°7',
  [ChordType.HalfDiminished7]: 'ø7',
};

export const formatElapsedMs = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const getChordLabel = (chord: ChordDefinition): string => {
  const noteName = chord.displayBaseNote ?? getNoteLabel(chord.baseNote);
  return `${noteName}${CHORD_QUALITY_LABELS[chord.type] ?? '?'}`;
};

export const getChordQualityLabel = (chordType: ChordType): string => CHORD_QUALITY_LABELS[chordType] ?? '?';

export const sortGameRuns = (records: GameRunRecord[]): GameRunRecord[] =>
  [...records].sort((first, second) => {
    if (first.elapsedMs !== second.elapsedMs) {
      return first.elapsedMs - second.elapsedMs;
    }
    return first.totalGuesses - second.totalGuesses;
  });

export const isInputSource = (value: unknown): value is InputSource =>
  value === 'midi' || value === 'manual' || value === 'mixed' || value === 'unknown';

export const normalizeAttempts = (value: unknown, fallbackSource: InputSource): GuessAttempt[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (attempt): attempt is GuessAttempt =>
        !!attempt &&
        typeof attempt === 'object' &&
        typeof (attempt as GuessAttempt).target === 'string' &&
        typeof (attempt as GuessAttempt).elapsedMs === 'number' &&
        typeof (attempt as GuessAttempt).wrongGuesses === 'number',
    )
    .map((attempt) => ({
      ...attempt,
      inputSource: isInputSource(attempt.inputSource) ? attempt.inputSource : fallbackSource,
    }));
};

export const normalizeGameRun = (
  entry: Partial<GameRunRecord>,
  fallbackGameType: TrainerGameType,
): GameRunRecord | null => {
  if (
    typeof entry.id !== 'string' ||
    typeof entry.completedAtIso !== 'string' ||
    typeof entry.elapsedMs !== 'number' ||
    typeof entry.totalGuesses !== 'number' ||
    typeof entry.wrongGuesses !== 'number' ||
    !Array.isArray(entry.guessedChords)
  ) {
    return null;
  }

  const inputSource = isInputSource(entry.inputSource) ? entry.inputSource : 'unknown';

  return {
    id: entry.id,
    completedAtIso: entry.completedAtIso,
    elapsedMs: entry.elapsedMs,
    totalGuesses: entry.totalGuesses,
    wrongGuesses: entry.wrongGuesses,
    voicingStyle: typeof entry.voicingStyle === 'string' ? entry.voicingStyle : 'Unknown',
    guessedChords: entry.guessedChords.filter((chord): chord is string => typeof chord === 'string'),
    attempts: normalizeAttempts(entry.attempts, inputSource),
    inputSource,
    gameType:
      entry.gameType === 'play' || entry.gameType === 'recognize' || entry.gameType === 'degree'
        ? entry.gameType
        : fallbackGameType,
  };
};

export const loadGameRunsFromStorage = (
  storageKey: string,
  fallbackGameType: TrainerGameType,
): GameRunRecord[] => {
  const rawValue = localStorage.getItem(storageKey);
  if (!rawValue) {
    return [];
  }

  const parsedValue = JSON.parse(rawValue) as Partial<GameRunRecord>[];
  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return sortGameRuns(
    parsedValue
      .map((entry) => normalizeGameRun(entry, fallbackGameType))
      .filter((entry): entry is GameRunRecord => entry !== null),
  );
};

export const saveGameRunsToStorage = (storageKey: string, records: GameRunRecord[]): void => {
  localStorage.setItem(storageKey, JSON.stringify(records));
};
