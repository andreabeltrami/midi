export enum ScaleType {
	Ionian = 0,      // Major
	Dorian = 1,
	Phrygian = 2,
	Lydian = 3,
	Mixolydian = 4,
	Aeolian = 5,     // Minor
	Locrian = 6,
}

export const getScaleLabel = (scale: ScaleType): string => {
	const labels: Record<ScaleType, string> = {
		[ScaleType.Ionian]: 'Major',
		[ScaleType.Dorian]: 'Dorian',
		[ScaleType.Phrygian]: 'Phrygian',
		[ScaleType.Lydian]: 'Lydian',
		[ScaleType.Mixolydian]: 'Mixolydian',
		[ScaleType.Aeolian]: 'Aeolian',
		[ScaleType.Locrian]: 'Locrian',
	};

	return labels[scale];
};

export const getMajorScales = (): ScaleType[] => [ScaleType.Ionian];

export const getModes = (): ScaleType[] => [
	ScaleType.Dorian,
	ScaleType.Phrygian,
	ScaleType.Lydian,
	ScaleType.Mixolydian,
	ScaleType.Aeolian,
	ScaleType.Locrian,
];

export const getScaleOptions = (): Array<{ label: string; value: ScaleType }> =>
	Object.values(ScaleType)
		.filter((value): value is ScaleType => typeof value === 'number')
		.map((value) => ({
			label: getScaleLabel(value),
			value,
		}));
