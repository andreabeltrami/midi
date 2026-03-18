import { Component, signal } from '@angular/core';
import { PlayChordComponent } from './components/play-chord/play-chord.component';
import { RecognizeChordComponent } from './components/recognize-chord/recognize-chord.component';

type GameMode = 'play' | 'recognize' | null;

@Component({
  selector: 'app-root',
  imports: [PlayChordComponent, RecognizeChordComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  selectedMode = signal<GameMode>(null);

  selectMode(mode: Exclude<GameMode, null>) {
    this.selectedMode.set(mode);
  }

  resetModeSelection() {
    this.selectedMode.set(null);
  }
}