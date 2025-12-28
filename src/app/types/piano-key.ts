import { Signal } from "@angular/core";
import { Note } from "./note";

export interface PianoKey {
	note: Note;
	isPressed: Signal<boolean>;
	keyType: "white" | "black";
}

