import { Component, signal } from '@angular/core';
import { ChordType } from '../../enums/chord-type';
import { Interval } from '../../enums/interval';
import { NoteType } from '../../enums/note-type';
import { VoicingStyle } from '../../enums/voicing-style';
import { ChordDefinition } from '../../types/chord-definition';
import { Note } from '../../types/note';
import { PlayChordComponent } from '../play-chord/play-chord.component';
import { KeyboardComponentComponent } from '../keyboard-component/keyboard-component.component';
import { KeyboardService } from '../../services/keyboard.service';
import * as Tone from 'tone';

@Component({
  selector: 'app-recognize-chord',
  imports: [KeyboardComponentComponent],
  templateUrl: './recognize-chord.component.html',
  styleUrl: './recognize-chord.component.css',
})
export class RecognizeChordComponent {
  readonly voicingOptions = Object.values(VoicingStyle);

  readonly noteOptions = Object.keys(NoteType)
    .filter((key) => isNaN(Number(key)))
    .map((label) => ({
      label,
      value: NoteType[label as keyof typeof NoteType] as NoteType,
    }));

  readonly chordTypeOptions = [
    { label: '-7', value: ChordType.Minor7 },
    { label: '7', value: ChordType.Perfect7 },
    { label: 'Maj7', value: ChordType.Major7 },
  ];

  currentChord = signal<ChordDefinition>(PlayChordComponent.generateRandomChord());
  currentChordWrong = signal(false);
  currentChordCorrect = signal(false);
  voicingStyle = signal<VoicingStyle>(VoicingStyle.Standard);

  selectedBaseNote = signal<NoteType>(NoteType.C);
  selectedChordType = signal<ChordType>(ChordType.Minor7);
  private sampler?: Tone.Sampler;

  constructor(protected keyboardService: KeyboardService) {
    this.drawChord();
    this.initializeToneSampler();
  }

  public changeChord() {
    this.generateNewChord();
    this.drawChord();
    this.clearFeedback();
  }

  public onVoicingChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as VoicingStyle;
    this.voicingStyle.set(value);
    this.drawChord();
  }

  public onBaseNoteChange(event: Event) {
    this.selectedBaseNote.set(Number((event.target as HTMLSelectElement).value) as NoteType);
  }

  public onChordTypeChange(event: Event) {
    this.selectedChordType.set(Number((event.target as HTMLSelectElement).value) as ChordType);
  }

  public submitGuess() {
    const matches =
      this.selectedBaseNote() === this.currentChord().baseNote &&
      this.selectedChordType() === this.currentChord().type;

    this.clearFeedback();

    if (matches) {
      this.currentChordCorrect.set(true);
      setTimeout(() => {
        this.currentChordCorrect.set(false);
        this.generateNewChord();
        this.drawChord();
      }, 500);
      return;
    }

    this.currentChordWrong.set(true);
    setTimeout(() => this.currentChordWrong.set(false), 500);
  }

  public async playCurrentChordPreview() {
    if (this.keyboardService.pressedNotes().length === 0) {
      this.drawChord();
    }

    await Tone.start();
    if (!this.sampler) {
      return;
    }

    const noteNames = this.keyboardService
      .pressedNotes()
      .map((note) => Tone.Frequency(note.originalNumber, 'midi').toNote());

    this.sampler.triggerAttackRelease(noteNames, '1n', Tone.now());
  }

  private initializeToneSampler() {
    try {
      this.sampler = new Tone.Sampler({
        urls: {
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
        },
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
    } catch (e) {
      console.error(e);
    }
  }

  private clearFeedback() {
    this.currentChordWrong.set(false);
    this.currentChordCorrect.set(false);
  }

  private drawChord() {
    let defaultAdder = 48;
    const chord = this.currentChord();
    const intervals = this.getIntervalsArray(chord.type);

    const notes: Note[] = [];
    const start = Math.random() < 0.5 ? 1 : 3;

    for (let i = 0; i < intervals.length; i++) {
      const index = (start + i) % intervals.length;
      notes.push(new Note(chord.baseNote + intervals[index] + defaultAdder));
      if (index === intervals.length - 1) {
        defaultAdder += 12;
      }
    }

    this.keyboardService.pressedNotes.set(notes);
  }

  private getIntervalsArray(chordType: ChordType): Interval[] {
    switch (chordType) {
      case ChordType.Minor7:
        return [Interval.II, Interval.IIIm, Interval.V, Interval.VIIm];
      case ChordType.Perfect7:
        return this.voicingStyle() === VoicingStyle.Standard
          ? [Interval.II, Interval.IIIM, Interval.V, Interval.VIIm]
          : [Interval.II, Interval.IIIM, Interval.VI, Interval.VIIm];
      case ChordType.Major7:
        return this.voicingStyle() === VoicingStyle.Standard
          ? [Interval.II, Interval.IIIM, Interval.V, Interval.VIIM]
          : [Interval.II, Interval.IIIM, Interval.V, Interval.VI];
    }
  }

  private generateNewChord() {
    let newChord = PlayChordComponent.generateRandomChord();
    while (
      newChord.baseNote === this.currentChord().baseNote &&
      newChord.type === this.currentChord().type
    ) {
      newChord = PlayChordComponent.generateRandomChord();
    }

    this.currentChord.set(newChord);
  }
}
