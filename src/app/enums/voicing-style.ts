
export enum VoicingStyle {
	Standard = 'Standard',
	BillEvans = 'Bill Evans (Rootless)',
	Base = 'Base'
}

export type VoicingGuideDefinition = {
	style: VoicingStyle;
	labelKey: string;
	summaryKey: string;
	chordFormulas: Array<{
		chordTypeKey: string;
		formula: string;
	}>;
};

export const VOICING_LABEL_KEYS: Record<VoicingStyle, string> = {
	[VoicingStyle.Standard]: 'voicing.standard.name',
	[VoicingStyle.BillEvans]: 'voicing.billEvans.name',
	[VoicingStyle.Base]: 'voicing.base.name',
};

export const getVoicingLabelKey = (style: string): string => {
	if (style in VOICING_LABEL_KEYS) {
		return VOICING_LABEL_KEYS[style as VoicingStyle];
	}

	return 'common.unknown';
};

export const VOICING_GUIDES: readonly VoicingGuideDefinition[] = [
	{
		style: VoicingStyle.Standard,
		labelKey: VOICING_LABEL_KEYS[VoicingStyle.Standard],
		summaryKey: 'voicing.standard.summary',
		chordFormulas: [
			{ chordTypeKey: 'voicing.minor7', formula: '9 · ♭3 · 5 · ♭7' },
			{ chordTypeKey: 'voicing.dominant7', formula: '9 · 3 · 5 · ♭7' },
			{ chordTypeKey: 'voicing.major7', formula: '9 · 3 · 5 · 7' },
		],
	},
	{
		style: VoicingStyle.BillEvans,
		labelKey: VOICING_LABEL_KEYS[VoicingStyle.BillEvans],
		summaryKey: 'voicing.billEvans.summary',
		chordFormulas: [
			{ chordTypeKey: 'voicing.minor7', formula: '9 · ♭3 · 5 · ♭7' },
			{ chordTypeKey: 'voicing.dominant7', formula: '9 · 3 · 13 · ♭7' },
			{ chordTypeKey: 'voicing.major7', formula: '9 · 3 · 5 · 6' },
		],
	},
	{
		style: VoicingStyle.Base,
		labelKey: VOICING_LABEL_KEYS[VoicingStyle.Base],
		summaryKey: 'voicing.base.summary',
		chordFormulas: [
			{ chordTypeKey: 'voicing.minor7', formula: '1 · ♭3 · 5 · ♭7' },
			{ chordTypeKey: 'voicing.dominant7', formula: '1 · 3 · 5 · ♭7' },
			{ chordTypeKey: 'voicing.major7', formula: '1 · 3 · 5 · 7' },
		],
	},
];
