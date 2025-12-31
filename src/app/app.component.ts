import { CommonModule } from '@angular/common';
import { Component, computed, Signal, signal } from '@angular/core';
import * as Tone from 'tone';
import { ChordType } from './enums/chord-type';
import { Interval } from './enums/interval';
import { MidiEventType } from './enums/midi-event-type';
import { NoteType } from './enums/note-type';
import { VoicingStyle } from './enums/voicing-style';
import { ChordDefinition } from './types/chord-definition';
import { PianoKey } from './types/piano-key';
import { Note } from './types/note';

@Component({
	selector: 'app-root',
	imports: [CommonModule],
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
	currentChordWrong = signal<boolean>(false);
	currentChordCorrect = signal<boolean>(false);

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

	lastMidiEventType = MidiEventType.Released;
	sampler?: Tone.Sampler;

	constructor() {

		try {
			navigator.requestMIDIAccess().then(this.onMidiAccess, (x) => {
				console.error(x);
			});
		}
		catch (e) {
			console.error(e);
		}

		try {

			this.sampler = new Tone.Sampler({
				urls: {
					"C4": "C4.mp3",
					"D#4": "Ds4.mp3",
					"F#4": "Fs4.mp3",
					"A4": "A4.mp3",
				},
				release: 1,
				baseUrl: "https://tonejs.github.io/audio/salamander/",
			}).toDestination();
			Tone.start();
		}
		catch (e) {
			console.error(e);
		}

	}

	public onVoicingChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value as VoicingStyle;
		this.voicingStyle.set(value);
	}

	public onPianoKeyPressed(pianoKey: PianoKey) {
		if (pianoKey.isPressed()) {
			this.handleNote(MidiEventType.Released, pianoKey.note.originalNumber, 127);
		}
		else {
			this.handleNote(MidiEventType.Pressed, pianoKey.note.originalNumber, 127);
		}
	}

	public resetPressedNotes() {
		this.pressedNotes().forEach(x => {
			this.handleNote(MidiEventType.Released, x.originalNumber, 127);
		})
	}

	private onMidiAccess = (midiAccess: MIDIAccess) => {
		const midiInput = midiAccess.inputs.get("input-0");
		if (midiInput) {
			midiInput.onmidimessage = this.onMIDIMessage;
		}
	}

	private onMIDIMessage = (event: MIDIMessageEvent): void => {
		if (!event.data)
			return;
		this.handleNote(event.data[0], event.data[1], event.data[2]);
	}

	private handleNote(status: number, noteId: number, velocity: number) {
		this.playSound(status, noteId, velocity);

		const eventType = status;
		const rawNote = noteId;

		let pressedNotes = this.pressedNotes();
		this.lastMidiEventType = eventType;
		if (eventType === MidiEventType.Pressed) {
			pressedNotes.push(new Note(rawNote));
		}
		else if (eventType === MidiEventType.Released) {
			const note = new Note(rawNote)
			pressedNotes = this.pressedNotes().filter(x => x.name !== note.name);
		}
		this.pressedNotes.set([...pressedNotes]);

		if (this.needCheckChord()) {
			if (this.checkChord()) {
				this.currentChordCorrect.set(true);
				setTimeout(() => {
					this.currentChordCorrect.set(false);
					this.generateNewChord();
				}, 500);

			}
			else {
				this.currentChordWrong.set(true);
				setTimeout(() => {
					this.currentChordWrong.set(false);
				}, 500);
			}
		}
	}

	private generateNewChord() {
		let newChord = AppComponent.generateRandomChord();
		while (newChord.baseNote === this.currentChord().baseNote && newChord.type === this.currentChord().type) {
			newChord = AppComponent.generateRandomChord();
		}

		this.currentChord.set(newChord);
	}

	private playSound(status: number, noteId: number, velocity: number) {

		if (!this.sampler)
			return;
		
		const command = status & 0xf0;
		const noteName = Tone.Frequency(noteId, "midi").toNote();

		if (command === 0x90 && velocity > 0) {
			this.sampler.triggerAttack(noteName, Tone.now(), velocity / 127);
		}
		else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
			this.sampler.triggerRelease(noteName, Tone.now());
		}
	}

	private getInterval(baseNote: Note, arrivalNote: Note): Interval {

		if (arrivalNote.type >= baseNote.type) {
			return arrivalNote.type - baseNote.type;
		}
		else {
			return (arrivalNote.type + 12) - baseNote.type;
		}
	}

	private needCheckChord(): boolean {
		if (this.pressedNotes().length !== 4)
			return false;

		if (this.lastMidiEventType !== MidiEventType.Pressed)
			return false;

		return true;
	}

	private checkChord(): boolean {
		const baseNote = new Note(this.currentChord().baseNote);
		const result: Interval[] = this.pressedNotes().map(x => this.getInterval(baseNote, x));
		const resString = result.sort((a, b) => a - b).map(i => Interval[i]).join(',');

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