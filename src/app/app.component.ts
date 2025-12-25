import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, Signal, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import * as Tone from 'tone';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, CommonModule],
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent {

	readonly voicingOptions = Object.values(VoicingStyle);
	readonly allKeys: PianoKey[] = Array.from({ length: 89 }, (_, i) => {
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

	currentChord = signal<ChordDefinition>(AppComponent.generateRandomChord());
	pressedNotes = signal<Note[]>([]);
	voicingStyle = signal<VoicingStyle>(VoicingStyle.Standard);

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
				chordTypeLabel = " Maj7";
				break;
		}

		return `${NoteType[chord.baseNote]}${chordTypeLabel}`;
	});



	private sampler = new Tone.Sampler({
		urls: {
			"C4": "C4.mp3",
			"D#4": "Ds4.mp3",
			"F#4": "Fs4.mp3",
			"A4": "A4.mp3",
		},
		release: 1,
		baseUrl: "https://tonejs.github.io/audio/salamander/",
	}).toDestination();

	constructor() {
		navigator.requestMIDIAccess().then(this.onMidiAccess, this.onMidiFailure);
		Tone.start();
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
	}

	handleNote(status: number, noteId: number, velocity: number) {
		this.playSound(status, noteId, velocity);

		const eventType = status;
		const rawNote = noteId;

		let pressedNotes = this.pressedNotes();

		if (eventType === MidiEventType.Pressed) {
			pressedNotes.push(new Note(rawNote));
		}
		else if (eventType === MidiEventType.Released) {
			const note = new Note(rawNote)
			pressedNotes = this.pressedNotes().filter(x => x.name !== note.name);
		}

		this.pressedNotes.set([...pressedNotes]);

		if (this.checkChord()) {
			this.currentChord.set(AppComponent.generateRandomChord());
		}
	}

	playSound(status: number, noteId: number, velocity: number) {
		const command = status & 0xf0;
		const noteName = Tone.Frequency(noteId, "midi").toNote();

		if (command === 0x90 && velocity > 0) {
			this.sampler.triggerAttack(noteName, Tone.now(), velocity / 127);
		}
		else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
			this.sampler.triggerRelease(noteName, Tone.now());
		}
	}

	onVoicingChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value as VoicingStyle;
		this.voicingStyle.set(value);
	}

	onPianoKeyPressed(pianoKey: PianoKey) {
		this.handleNote(MidiEventType.Pressed, pianoKey.note.originalNumber, 127);
		setTimeout(() => {
			this.handleNote(MidiEventType.Released, pianoKey.note.originalNumber, 127);
		}, 500);		
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

	checkChord(): boolean {

		if (this.pressedNotes().length !== 4)
			return false;

		const baseNote = new Note(this.currentChord().baseNote);
		const result: Interval[] = this.pressedNotes().map(x => this.getInterval(baseNote, x));
		const resString = result.sort((a, b) => a - b).map(i => Interval[i]).join(',');
		console.log(resString);

		switch (this.currentChord().type) {
			case ChordType.Minor7:
				return resString === 'II,IIIm,V,VIIm'
			case ChordType.Perfect7:
				return resString ===
					(this.voicingStyle() === VoicingStyle.Standard ? 'II,IIIM,V,VIIm' : 'II,IIIM,VI,VIIm')
			case ChordType.Major7:
				return resString ===
					(this.voicingStyle() === VoicingStyle.Standard ? 'II,IIIM,V,VIIM' : 'II,IIIM,V,VI')
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
	isPressed: Signal<boolean>;
	keyType: "white" | "black";
}

export enum ChordType {
	Minor7,
	Perfect7,
	Major7
}

export enum VoicingStyle {
	Standard = 'Standard',
	BillEvans = 'Bill Evans (Rootless)'
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