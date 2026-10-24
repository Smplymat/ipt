import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';

export interface TabSegment {
  value: string;
  label: string;
  icon?: string;
  count?: number;
  disabled?: boolean;
}

@Component({
  selector: 'ktk-segmented-tabs',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="segmented-tabs" [class.full-width]="fullWidth" role="tablist" [attr.aria-label]="ariaLabel">
      @for (segment of segments; track segment.value; let i = $index) {
        <button
          type="button"
          role="tab"
          [class]="segmentClasses(segment, i)"
          [disabled]="segment.disabled"
          [attr.aria-selected]="activeValue === segment.value"
          [attr.aria-controls]="panelId(segment.value)"
          [id]="tabId(segment.value)"
          (click)="onSegmentClick(segment)"
          (keydown)="onKeydown($event, i)">
          @if (segment.icon) {
            <ion-icon [name]="segment.icon" aria-hidden="true"></ion-icon>
          }
          <span class="segment-label">{{ segment.label }}</span>
          @if (segment.count !== undefined && segment.count > 0) {
            <span class="segment-count">{{ segment.count > 99 ? '99+' : segment.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    .segmented-tabs {
      display: inline-flex;
      align-items: center;
      gap: var(--ktk-space-1);
      background: var(--ktk-muted-beige);
      border-radius: var(--ktk-radius-button);
      padding: var(--ktk-space-1);
      border: 1px solid var(--ktk-muted-beige);

      &.full-width {
        width: 100%;
      }

      &.full-width button {
        flex: 1;
      }
    }

    .segmented-tabs button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ktk-space-1);
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      font-weight: var(--ktk-fw-semibold);
      color: var(--ktk-text);
      background: transparent;
      border: none;
      border-radius: calc(var(--ktk-radius-button) - 4px);
      padding: var(--ktk-space-2) var(--ktk-space-4);
      min-height: 40px;
      cursor: pointer;
      transition: all var(--ktk-dur-fast) var(--ktk-ease-out);
      white-space: nowrap;

      &:hover:not(:disabled) {
        background: var(--ktk-card-bg);
      }

      &:focus-visible {
        outline: var(--ktk-focus-ring-width) solid var(--ktk-focus-ring-color);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.segment-active {
        background: var(--ktk-accent);
        color: var(--ktk-text-on-accent);
        font-weight: var(--ktk-fw-bold);
        box-shadow: 0 2px 8px var(--ktk-accent-focus);
      }

      ion-icon {
        font-size: 1.125rem;
        flex-shrink: 0;
      }

      .segment-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 6px;
        border-radius: 9px;
        background: var(--ktk-primary);
        color: var(--ktk-primary-contrast);
        font-size: 0.625rem;
        font-weight: var(--ktk-fw-bold);
      }

      &.segment-active .segment-count {
        background: var(--ktk-text-on-accent);
        color: var(--ktk-accent);
      }
    }
  `]
})
export class SegmentedTabsComponent {
  @Input() segments: TabSegment[] = [];
  @Input() activeValue = '';
  @Input() fullWidth = false;
  @Input() ariaLabel = 'Segmented tabs';

  @Output() valueChange = new EventEmitter<string>();

  segmentClasses = (segment: TabSegment, index: number): string => {
    const classes = ['segment-btn'];
    if (this.activeValue === segment.value) classes.push('segment-active');
    if (segment.disabled) classes.push('segment-disabled');
    return classes.join(' ');
  };

  tabId = (value: string): string => `tab-${value}`;
  panelId = (value: string): string => `panel-${value}`;

  onSegmentClick(segment: TabSegment): void {
    if (!segment.disabled && this.activeValue !== segment.value) {
      this.valueChange.emit(segment.value);
    }
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    const segments = this.segments.filter(s => !s.disabled);
    const currentIndex = segments.findIndex(s => s.value === this.activeValue);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        newIndex = Math.min(currentIndex + 1, segments.length - 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = Math.max(currentIndex - 1, 0);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = segments.length - 1;
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex && segments[newIndex]) {
      this.valueChange.emit(segments[newIndex].value);
    }
  }
}