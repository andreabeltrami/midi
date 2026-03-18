import { Component, signal } from '@angular/core';
import { PlayChordComponent } from './components/play-chord/play-chord.component';
import { RecognizeChordComponent } from './components/recognize-chord/recognize-chord.component';
import { RecognizeResultsTableComponent } from './components/recognize-results-table/recognize-results-table.component';

type GameMode = 'play' | 'recognize' | 'leaderboard' | null;

@Component({
  selector: 'app-root',
  imports: [PlayChordComponent, RecognizeChordComponent, RecognizeResultsTableComponent],
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