import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MidiService {
  private readonly storageKey = 'midi-selected-input';
  private midiAccess?: MIDIAccess;
  private selectedInput?: MIDIInput;

  readonly inputs = signal<MIDIInput[]>([]);
  readonly selectedInputId = signal<string | null>(null);
  readonly midiMessage$ = new Subject<MIDIMessageEvent>();

  constructor() {
    const savedInputId = localStorage.getItem(this.storageKey);
    this.selectedInputId.set(savedInputId);
    void this.initialize();
  }

  selectInput(event: Event): void {
    const inputId = (event.target as HTMLSelectElement).value;
    this.setSelectedInput(inputId || null);
  }

  private async initialize(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.onstatechange = () => this.refreshInputs();
      this.refreshInputs();
    } catch (error) {
      console.error(error);
    }
  }

  private refreshInputs(): void {
    if (!this.midiAccess) {
      return;
    }

    const inputs = Array.from(this.midiAccess.inputs.values());
    this.inputs.set(inputs);

    const selectedId = this.selectedInputId();
    const nextInput = inputs.find((input) => input.id === selectedId) ?? inputs[0];
    this.setSelectedInput(nextInput?.id ?? null, false);
  }

  private setSelectedInput(inputId: string | null, persist = true): void {
    if (this.selectedInput) {
      this.selectedInput.onmidimessage = null;
    }

    this.selectedInput = this.inputs().find((input) => input.id === inputId);
    this.selectedInputId.set(this.selectedInput?.id ?? null);

    if (persist) {
      if (this.selectedInput) {
        localStorage.setItem(this.storageKey, this.selectedInput.id);
      } else {
        localStorage.removeItem(this.storageKey);
      }
    }

    if (this.selectedInput) {
      this.selectedInput.onmidimessage = (event) => this.midiMessage$.next(event);
    }
  }
}
