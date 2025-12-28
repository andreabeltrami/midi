import { NoteType } from '../enums/note-type';
export class Note {
	type: NoteType;
	originalNumber: number;
	name: string;

	constructor(number: number) {
		this.originalNumber = number;
		this.type = (number % 12);
		this.name = `${NoteType[this.type]}${Math.floor(this.originalNumber / 12)}`;
	}

	toString(): string {
		return this.name;
	}
}
