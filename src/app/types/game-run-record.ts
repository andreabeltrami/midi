import { VoicingStyle } from '../enums/voicing-style';

export type TrainerGameType = 'play' | 'recognize' | 'degree';
export type InputSource = 'midi' | 'manual' | 'mixed' | 'unknown';

export interface GuessAttempt {
  target: string;
  elapsedMs: number;
  wrongGuesses: number;
  inputSource: InputSource;
}

export interface GameRunRecord {
  id: string;
  completedAtIso: string;
  elapsedMs: number;
  totalGuesses: number;
  wrongGuesses: number;
  voicingStyle: VoicingStyle | 'Unknown' | 'degree' | 'major-scale' | 'modes';
  guessedChords: string[];
  attempts: GuessAttempt[];
  inputSource: InputSource;
  gameType: TrainerGameType;
}
