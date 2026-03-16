import { Component, computed, signal } from '@angular/core';
import { ChordType } from '../../enums/chord-type';
import { Interval } from '../../enums/interval';
import { MidiEventType } from '../../enums/midi-event-type';
import { NoteType } from '../../enums/note-type';
import { VoicingStyle } from '../../enums/voicing-style';
import { ChordDefinition } from '../../types/chord-definition';
import { Note } from '../../types/note';
import { PianoKey } from '../../types/piano-key';
import { PlayChordComponent } from '../play-chord/play-chord.component';
import * as Tone from 'tone';
import { KeyboardComponentComponent } from "../keyboard-component/keyboard-component.component";
import { KeyboardService } from '../../services/keyboard.service';


@Component({
  selector: 'app-recognize-chord',
  imports: [KeyboardComponentComponent],
  templateUrl: './recognize-chord.component.html',
  styleUrl: './recognize-chord.component.css',
})
export class RecognizeChordComponent {

  readonly voicingOptions = Object.values(VoicingStyle);

  currentChord = signal<ChordDefinition>(PlayChordComponent.generateRandomChord());
  currentChordWrong = signal<boolean>(false);
  currentChordCorrect = signal<boolean>(false);
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


  constructor(protected keyboardService: KeyboardService) { 
  }

  public changeChord() {
    this.generateNewChord();
    this.drawChord();
  }

  public onVoicingChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as VoicingStyle;
    this.voicingStyle.set(value);
  }

  private drawChord() {
    let defaultAdder = 48;
    const chord = this.currentChord();
    const intervals = this.getIntervalsArray(chord.type);

    const notes = [];
    const start = Math.random() < 0.5 ? 1 : 3; // Uso o il 1 o il 3 rivolto per semplificare

    for (let i = 0; i < intervals.length; i++) {
      const index = (start + i) % intervals.length;
      notes.push(new Note(chord.baseNote + intervals[index] + defaultAdder));
      if (index === intervals.length - 1) {
        defaultAdder += 12;
      }
    }

    this.keyboardService.pressedNotes.set([...notes]);
  }

  private getIntervalsArray(chordType: ChordType): Interval[] {
    switch (chordType) {
      case ChordType.Minor7:
        return [Interval.II, Interval.IIIm, Interval.V, Interval.VIIm];
      case ChordType.Perfect7:
        if (this.voicingStyle() === VoicingStyle.Standard) {
          return [Interval.II, Interval.IIIM, Interval.V, Interval.VIIm];
        }
        else {
          return [Interval.II, Interval.IIIM, Interval.VI, Interval.VIIm];
        }
      case ChordType.Major7:
        if (this.voicingStyle() === VoicingStyle.Standard) {
          return [Interval.II, Interval.IIIM, Interval.V, Interval.VIIM];
        }
        else {
          return [Interval.II, Interval.IIIM, Interval.V, Interval.VI];
        }
    }
  }

  private generateNewChord() {
    let newChord = PlayChordComponent.generateRandomChord();
    while (newChord.baseNote === this.currentChord().baseNote && newChord.type === this.currentChord().type) {
      newChord = PlayChordComponent.generateRandomChord();
    }

    this.currentChord.set(newChord);
  }



  static generateRandomChord(): ChordDefinition {
    return {
      baseNote: PlayChordComponent.getRandomEnumValue(NoteType),
      type: PlayChordComponent.getRandomEnumValue(ChordType)
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
