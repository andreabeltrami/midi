import { VoicingStyle } from '../enums/voicing-style';

export interface GameRunRecord {
  id: string;
  completedAtIso: string;
  elapsedMs: number;
  totalGuesses: number;
  wrongGuesses: number;
  voicingStyle: VoicingStyle | 'Unknown';
  guessedChords: string[];
}
