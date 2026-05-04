import { VoicingStyle } from '../enums/voicing-style';

export type TrainerGameType = 'play' | 'recognize' | 'degree';

export interface GameRunRecord {
  id: string;
  completedAtIso: string;
  elapsedMs: number;
  totalGuesses: number;
  wrongGuesses: number;
  voicingStyle: VoicingStyle | 'Unknown' | 'degree' | 'major-scale' | 'modes';
  guessedChords: string[];
  gameType: TrainerGameType;
}
