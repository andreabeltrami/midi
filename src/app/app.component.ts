import { Component, inject, signal } from '@angular/core';
import { PlayChordComponent } from './components/play-chord/play-chord.component';
import { RecognizeChordComponent } from './components/recognize-chord/recognize-chord.component';
import { ResultTableComponent } from './components/result-table/result-table.component';
import { TranslatePipe } from './pipes/translate.pipe';
import { I18nService, SupportedLanguage } from './services/i18n.service';

type GameMode = 'play' | 'recognize' | 'leaderboard' | null;

@Component({
  selector: 'app-root',
  imports: [PlayChordComponent, RecognizeChordComponent, ResultTableComponent, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly i18n = inject(I18nService);
  selectedMode = signal<GameMode>(null);

  selectMode(mode: Exclude<GameMode, null>) {
    this.selectedMode.set(mode);
  }

  resetModeSelection() {
    this.selectedMode.set(null);
  }

  setLanguage(language: SupportedLanguage) {
    void this.i18n.useLanguage(language);
  }
}