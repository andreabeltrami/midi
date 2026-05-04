import { ChordDegree } from '../enums/chord-degree';
import { Interval } from '../enums/interval';

export const degreeToDegreeLabel: Record<ChordDegree, Interval> = {
	[ChordDegree.Root]: Interval.I,
	[ChordDegree.Flat9]: Interval.IIb,
	[ChordDegree.Nine]: Interval.II,
	[ChordDegree.Sharp9]: Interval.IIIm,
	[ChordDegree.Three]: Interval.IIIM,
	[ChordDegree.Eleven]: Interval.IV,
	[ChordDegree.Sharp11]: Interval.Vb,
	[ChordDegree.Five]: Interval.V,
	[ChordDegree.Flat13]: Interval.VIb,
	[ChordDegree.Thirteen]: Interval.VI,
	[ChordDegree.Flat7]: Interval.VIIm,
	[ChordDegree.Seven]: Interval.VIIM,
};

export const intervalToChordDegree = (interval: Interval): ChordDegree => {
	const degreeIndex = Object.values(degreeToDegreeLabel).indexOf(interval);
	if (degreeIndex === -1) {
		return ChordDegree.Root;
	}
	return degreeIndex as ChordDegree;
};
