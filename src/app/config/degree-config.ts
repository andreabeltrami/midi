import { ChordDegree } from '../enums/chord-degree';

// Gradi disponibili per la modalità Chord (3 e 7 variano in base al tipo di accordo)
export const CHORD_AVAILABLE_DEGREES: ChordDegree[] = [
	ChordDegree.Flat9,
	ChordDegree.Nine,
	ChordDegree.Sharp9,
	ChordDegree.Three,      // 3 (maggiore o minore in base all'accordo)
	ChordDegree.Eleven,
	ChordDegree.Sharp11,
	ChordDegree.Five,
	ChordDegree.Flat13,
	ChordDegree.Thirteen,
	ChordDegree.Seven,      // 7 (maggiore o minore in base all'accordo)
];

// Gradi disponibili per la modalità Scale (tutti i gradi)
export const SCALE_AVAILABLE_DEGREES: ChordDegree[] = [
	ChordDegree.Root,
	ChordDegree.Flat9,
	ChordDegree.Nine,
	ChordDegree.Sharp9,
	ChordDegree.Three,
	ChordDegree.Eleven,
	ChordDegree.Sharp11,
	ChordDegree.Five,
	ChordDegree.Flat13,
	ChordDegree.Thirteen,
	ChordDegree.Flat7,
	ChordDegree.Seven,
];
