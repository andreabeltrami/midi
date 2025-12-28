import { ChordType } from "../enums/chord-type";
import { NoteType } from "../enums/note-type";

export type ChordDefinition = {
	baseNote: NoteType;
	type: ChordType;
};
