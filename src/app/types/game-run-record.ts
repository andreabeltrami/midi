import { VoicingStyle } from '../enums/voicing-style';

export type TrainerGameType = 'play' | 'recognize';

export interface GameRunRecord {
  id: string;
  completedAtIso: string;
  elapsedMs: number;
  totalGuesses: number;
  wrongGuesses: number;
  voicingStyle: VoicingStyle | 'Unknown';
  guessedChords: string[];
  gameType: TrainerGameType;
}
