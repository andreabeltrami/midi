import { Component } from "@angular/core";
import { RecognizeChordComponent } from "./components/recognize-chord/recognize-chord.component";

@Component({
	selector: 'app-root',
	imports: [RecognizeChordComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent {

}