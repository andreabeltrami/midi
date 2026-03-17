import { ChordType } from '../enums/chord-type';
import { Interval } from '../enums/interval';
import { VoicingStyle } from '../enums/voicing-style';

export const CHORD_VOICINGS: Record<ChordType, Partial<Record<VoicingStyle, readonly Interval[]>>> = {
	[ChordType.Minor7]: {
		[VoicingStyle.Standard]: [Interval.II, Interval.IIIm, Interval.V, Interval.VIIm],
		[VoicingStyle.Base]: [Interval.I, Interval.IIIm, Interval.V, Interval.VIIm],
	},
	[ChordType.Perfect7]: {
		[VoicingStyle.Standard]: [Interval.II, Interval.IIIM, Interval.V, Interval.VIIm],
		[VoicingStyle.BillEvans]: [Interval.II, Interval.IIIM, Interval.VI, Interval.VIIm],
		[VoicingStyle.Base]: [Interval.I, Interval.IIIM, Interval.V, Interval.VIIm],
	},
	[ChordType.Major7]: {
		[VoicingStyle.Standard]: [Interval.II, Interval.IIIM, Interval.V, Interval.VIIM],
		[VoicingStyle.BillEvans]: [Interval.II, Interval.IIIM, Interval.V, Interval.VI],
		[VoicingStyle.Base]: [Interval.I, Interval.IIIM, Interval.V, Interval.VIIM],
	},
};

export const getChordVoicingIntervals = (
	chordType: ChordType,
	voicingStyle: VoicingStyle
): readonly Interval[] | undefined => {
	const voicingDefinitions = CHORD_VOICINGS[chordType];
	return voicingDefinitions[voicingStyle] ?? voicingDefinitions[VoicingStyle.Standard];
};
