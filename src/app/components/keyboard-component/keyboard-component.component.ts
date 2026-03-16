import { Component } from '@angular/core';
import { KeyboardService } from '../../services/keyboard.service';
import { PianoKey } from '../../types/piano-key';

@Component({
	selector: 'app-keyboard-component',
	imports: [],
	templateUrl: './keyboard-component.component.html',
	styleUrl: './keyboard-component.component.css',
})
export class KeyboardComponentComponent {

	constructor(public keyboardService: KeyboardService) { }

	onPianoKeyPressed(pianoKey: PianoKey) {
		this.keyboardService.onPianoManuallyKeyPressed$.next(pianoKey);
	}

}
