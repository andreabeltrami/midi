import { Component, inject, signal } from '@angular/core';
import { PlayChordComponent } from './components/play-chord/play-chord.component';
import { RecognizeChordComponent } from './components/recognize-chord/recognize-chord.component';
import { PlayDegreeComponent } from './components/play-degree/play-degree.component';
import { ResultTableComponent } from './components/result-table/result-table.component';
import { TranslatePipe } from './pipes/translate.pipe';
import { I18nService, SupportedLanguage } from './services/i18n.service';
import { MidiService } from './services/midi.service';
import { AuthService } from './services/auth.service';

type GameMode = 'play' | 'recognize' | 'degree' | 'leaderboard' | null;

@Component({
  selector: 'app-root',
  imports: [PlayChordComponent, RecognizeChordComponent, PlayDegreeComponent, ResultTableComponent, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly i18n = inject(I18nService);
  readonly midi = inject(MidiService);
  readonly auth = inject(AuthService);
  selectedMode = signal<GameMode>(null);
  mobileMenuOpen = signal(false);

  selectMode(mode: Exclude<GameMode, null>) {
    this.selectedMode.set(mode);
    this.mobileMenuOpen.set(false);
  }

  resetModeSelection() {
    this.selectedMode.set(null);
    this.mobileMenuOpen.set(false);
  }

  setLanguage(language: SupportedLanguage) {
    void this.i18n.useLanguage(language);
  }

  signInWithGoogle() {
    void this.auth.signInWithGoogle();
  }

  signOut() {
    void this.auth.signOut();
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update((open) => !open);
  }
}