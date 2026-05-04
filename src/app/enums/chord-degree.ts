export enum ChordDegree {
	Root = 0,      // 1
	Flat9 = 1,     // b9
	Nine = 2,      // 9
	Sharp9 = 3,    // #9
	Three = 4,     // 3
	Eleven = 5,    // 11
	Sharp11 = 6,   // #11
	Five = 7,      // 5
	Flat13 = 8,    // b13
	Thirteen = 9,  // 13
	Flat7 = 10,    // b7
	Seven = 11,    // 7
}

export const getDegreeLabel = (degree: ChordDegree): string => {
	const labels: Record<ChordDegree, string> = {
		[ChordDegree.Root]: '1',
		[ChordDegree.Flat9]: 'b9',
		[ChordDegree.Nine]: '9',
		[ChordDegree.Sharp9]: '#9',
		[ChordDegree.Three]: '3',
		[ChordDegree.Eleven]: '11',
		[ChordDegree.Sharp11]: '#11',
		[ChordDegree.Five]: '5',
		[ChordDegree.Flat13]: 'b13',
		[ChordDegree.Thirteen]: '13',
		[ChordDegree.Flat7]: 'b7',
		[ChordDegree.Seven]: '7',
	};

	return labels[degree];
};

export const getDegreeOptions = (): Array<{ label: string; value: ChordDegree }> =>
	Object.values(ChordDegree)
		.filter((value): value is ChordDegree => typeof value === 'number')
		.map((value) => ({
			label: getDegreeLabel(value),
			value,
		}));
