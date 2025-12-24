import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, CommonModule],
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent {

	title = 'midi';

	currentChord = signal<ChordDefinition>(AppComponent.generateRandomChord());

	readonly allKeys = Array.from({ length: 89 }, (_, i) => {
		const blackNoteOffsets = [1, 3, 6, 8, 10];
		const value = i + 24;
		return {
			note: new Note(value),
			keyType: blackNoteOffsets.includes((value) % 12) ? "black" : "white",
			isPressed: computed(() => {
				return this.pressedNotes().filter(x => x.originalNumber === value).length > 0
			})
		};
	});
	
	pressedNotes = signal<Note[]>([]);
	currentChordString = computed(() => {
		const chord = this.currentChord();
		if (!chord) return '';
		let chordTypeLabel = "";
		switch (chord.type) {
			case ChordType.Minor7:
				chordTypeLabel = "-7";
				break;
			case ChordType.Perfect7:
				chordTypeLabel = "7";
				break;
			case ChordType.Major7:
				chordTypeLabel = "Maj7";
				break;
		}

		return `${NoteType[chord.baseNote]}${chordTypeLabel}`;
	});

	constructor() {
		this.generatePianoKeys();
		navigator.requestMIDIAccess().then(this.onMidiAccess, this.onMidiFailure)
	}

	generatePianoKeys() {

	}

	onMidiAccess = (midiAccess: MIDIAccess) => {
		const midiInput = midiAccess.inputs.get("input-0");
		if (midiInput) {
			midiInput.onmidimessage = this.onMIDIMessage;
		}
	}

	onMIDIMessage = (event: MIDIMessageEvent): void => {
		if (!event.data)
			return;

		const eventType = event.data[0];
		const rawNote = event.data[1];

		let pressedNotes = this.pressedNotes();

		if (eventType === MidiEventType.Pressed) {
			pressedNotes.push(new Note(rawNote));
		}
		else if (eventType === MidiEventType.Released) {
			const note = new Note(rawNote)
			pressedNotes = this.pressedNotes().filter(x => x.name !== note.name);
		}

		this.pressedNotes.set([... pressedNotes]);

		if (this.isCurrentABillEvansChords()) {
			this.currentChord.set(AppComponent.generateRandomChord());
		}

	}

	onMidiFailure(reason: any) {

	}

	getInterval(baseNote: Note, arrivalNote: Note): Interval {

		if (arrivalNote.type >= baseNote.type) {
			return arrivalNote.type - baseNote.type;
		}
		else {
			return (arrivalNote.type + 12) - baseNote.type;
		}
	}

	isCurrentABillEvansChords(): boolean {

		if (this.pressedNotes.length !== 4)
			return false;

		const baseNote = new Note(this.currentChord().baseNote);
		const result: Interval[] = this.pressedNotes().map(x => this.getInterval(baseNote, x));
		const resString = result.sort((a, b) => a - b).map(i => Interval[i]).join(',');
		console.log(resString);

		switch (this.currentChord().type) {
			case ChordType.Minor7:
				return resString === 'II,IIIm,V,VIIm'
			case ChordType.Perfect7:
				return resString === 'II,IIIM,V,VIIm'
			case ChordType.Major7:
				return resString === 'II,IIIM,V,VIIM'

		}
	}

	static generateRandomChord(): ChordDefinition {
		return {
			baseNote: AppComponent.getRandomEnumValue(NoteType),
			type: AppComponent.getRandomEnumValue(ChordType)
		};

	}

	static getRandomEnumValue = (enumeration: any) => {
		const values = Object.keys(enumeration)
			.filter(k => !isNaN(Number(k)))
			.map(k => Number(k));

		const randomIndex = Math.floor(Math.random() * values.length);
		return values[randomIndex];
	};


}

export type ChordDefinition = {
	baseNote: NoteType;
	type: ChordType;
}



export class Note {
	type: NoteType;
	originalNumber: number;
	name: string;

	constructor(number: number) {
		this.originalNumber = number;
		this.type = (number % 12);
		this.name = `${NoteType[this.type]}${Math.floor(this.originalNumber / 12)}`
	}

	toString(): string {
		return this.name;
	}

}

export interface PianoKey {
	note: Note;
	isPressed: boolean;
	keyType: "white" | "black";
}

export enum ChordType {
	Minor7,
	Perfect7,
	Major7
}

export enum NoteType {
	C, Db, D, Eb, E, F, Gb, G, Ab, A, Bb, B
}

export enum Interval {
	I = 0,
	IIb = 1,
	II = 2,
	IIIm = 3,
	IIIM = 4,
	IV = 5,
	Vb = 6,
	V = 7,
	VIb = 8,
	VI = 9,
	VIIm = 10,
	VIIM = 11
}

export enum MidiEventType {
	Pressed = 144,
	Released = 128,
}