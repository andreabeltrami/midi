import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  getVoicingLabelKey,
  VOICING_GUIDES,
  VoicingGuideDefinition,
  VoicingStyle,
} from '../../enums/voicing-style';

@Component({
  selector: 'app-voicing-info',
  imports: [TranslatePipe],
  templateUrl: './voicing-info.component.html',
  styleUrl: './voicing-info.component.css',
})
export class VoicingInfoComponent {
  readonly activeStyle = input<VoicingStyle | null>(null);
  readonly guides = VOICING_GUIDES;

  isActive(guide: VoicingGuideDefinition): boolean {
    return this.activeStyle() === guide.style;
  }

  getActiveLabelKey(): string {
    return this.activeStyle() ? getVoicingLabelKey(this.activeStyle()!) : 'common.unknown';
  }
}
