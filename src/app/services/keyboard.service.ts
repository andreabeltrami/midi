import { computed, Injectable, signal } from '@angular/core';
import { VoicingStyle } from '../enums/voicing-style';
import { PianoKey } from '../types/piano-key';
import { Note } from '../types/note';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class KeyboardService {
  
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

  public pressedNotes = signal<Note[]>([]);
  public onPianoManuallyKeyPressed$ = new Subject<PianoKey>();
}
