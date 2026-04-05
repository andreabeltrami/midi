
export enum NoteType {
	C, Db, D, Eb, E, F, Gb, G, Ab, A, Bb, B
}

export type AccidentalDisplayMode = 'flat' | 'sharp' | 'random';

const NOTE_LABELS: Record<NoteType, readonly [string, string?]> = {
	[NoteType.C]: ['C'],
	[NoteType.Db]: ['Db', 'C#'],
	[NoteType.D]: ['D'],
	[NoteType.Eb]: ['Eb', 'D#'],
	[NoteType.E]: ['E'],
	[NoteType.F]: ['F'],
	[NoteType.Gb]: ['Gb', 'F#'],
	[NoteType.G]: ['G'],
	[NoteType.Ab]: ['Ab', 'G#'],
	[NoteType.A]: ['A'],
	[NoteType.Bb]: ['Bb', 'A#'],
	[NoteType.B]: ['B'],
};

export const getNoteLabel = (
	noteType: NoteType,
	mode: AccidentalDisplayMode = 'flat'
): string => {
	const [flatLabel, sharpLabel] = NOTE_LABELS[noteType] ?? ['?'];

	if (mode === 'sharp' && sharpLabel) {
		return sharpLabel;
	}

	if (mode === 'random' && sharpLabel) {
		return Math.random() < 0.5 ? flatLabel : sharpLabel;
	}

	return flatLabel;
};

export const getNoteOptions = (): Array<{ label: string; value: NoteType }> =>
	Object.values(NoteType)
		.filter((value): value is NoteType => typeof value === 'number')
		.flatMap((value) => {
			const [flatLabel, sharpLabel] = NOTE_LABELS[value];

			return sharpLabel
				? [
					{ label: flatLabel, value },
					{ label: sharpLabel, value },
				]
				: [{ label: flatLabel, value }];
		});
