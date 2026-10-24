import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';

export type ChipVariant = 'default' | 'active' | 'outline' | 'accent' | 'pastel' | 'ghost' | 'danger';
export type ChipSize = 'sm' | 'md';

@Component({
  selector: 'ktk-chip',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <button
      type="button"
      [class]="hostClasses()"
      [disabled]="disabled"
      (click)="onClick.emit($event)"
      [attr.aria-pressed]="selectable ? selected : null"
      [attr.role]="selectable ? 'switch' : 'button'"
      [style.--chip-bg]="chipBg"
      [style.--chip-border]="chipBorder">
      @if (icon) {
        <ion-icon [name]="icon" slot="start" aria-hidden="true"></ion-icon>
      }
      <span class="chip-label"><ng-content></ng-content></span>
      @if (removable && !disabled) {
        <button type="button" class="chip-remove" (click)="onRemove.emit($event)" aria-label="Remove">
          <ion-icon name="close-outline" aria-hidden="true"></ion-icon>
        </button>
      }
    </button>
  `,
  styles: [`
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--ktk-space-1);
      font-family: var(--ktk-font-sans);
      font-weight: var(--ktk-fw-semibold);
      border-radius: var(--ktk-radius-button);
      border: var(--ktk-border-width-bold) solid transparent;
      cursor: pointer;
      transition: all var(--ktk-dur-fast) var(--ktk-ease-out);
      white-space: nowrap;
      user-select: none;
      min-height: var(--ktk-chip-height);
      padding: 0 var(--ktk-chip-padding-x);

      &.chip-sm {
        min-height: 28px;
        padding: 0 var(--ktk-space-2);
        font-size: var(--ktk-fs-xs);
      }

      &:not(.chip-sm) {
        font-size: var(--ktk-fs-sm);
      }

      /* Variants */
      &.chip-default {
        background: var(--ktk-muted-beige);
        color: var(--ktk-text);
        border-color: var(--ktk-muted-beige);

        &:hover:not(:disabled) {
          background: var(--ktk-primary);
          color: var(--ktk-primary-contrast);
          border-color: var(--ktk-primary);
        }
      }

      &.chip-active {
        background: var(--ktk-primary);
        color: var(--ktk-primary-contrast);
        border-color: var(--ktk-primary);
        font-weight: var(--ktk-fw-bold);
      }

      &.chip-outline {
        background: transparent;
        color: var(--ktk-primary);
        border-color: var(--ktk-primary);

        &:hover:not(:disabled) {
          background: var(--ktk-primary);
          color: var(--ktk-primary-contrast);
        }
      }

      &.chip-accent {
        background: var(--ktk-accent-light);
        color: var(--ktk-accent-text);
        border-color: var(--ktk-accent);

        &:hover:not(:disabled) {
          background: var(--ktk-accent);
          color: var(--ktk-text-on-accent);
        }
      }

      &.chip-ghost {
        background: transparent;
        color: var(--ktk-text);
        border-color: transparent;

        &:hover:not(:disabled) {
          background: var(--ktk-muted-beige);
        }
      }

      &.chip-danger {
        background: var(--ktk-error-bg);
        color: var(--ktk-error);
        border-color: var(--ktk-error-border);

        &:hover:not(:disabled) {
          background: var(--ktk-error);
          color: var(--ktk-card);
        }
      }

      &.chip-pastel {
        background: var(--chip-bg, var(--ktk-pastel-yellow));
        color: var(--ktk-text);
        border-color: var(--chip-border, transparent);

        &:hover:not(:disabled) {
          filter: brightness(0.95);
        }
      }

      /* Disabled */
      &:disabled,
      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Focus */
      &:focus-visible {
        outline: var(--ktk-focus-ring-width) solid var(--ktk-focus-ring-color);
        outline-offset: var(--ktk-focus-ring-offset);
      }

      /* Remove button */
      .chip-remove {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: inherit;
        opacity: 0.7;
        margin-left: var(--ktk-space-1);
        padding: 0;

        &:hover {
          background: rgba(0, 0, 0, 0.1);
          opacity: 1;
        }

        ion-icon {
          font-size: 0.875rem;
        }
      }

      ion-icon {
        font-size: 1rem;
        flex-shrink: 0;
      }
    }
  `]
})
export class ChipComponent {
  @Input() variant: ChipVariant = 'default';
  @Input() size: ChipSize = 'md';
  @Input() disabled = false;
  @Input() selectable = false;
  @Input() selected = false;
  @Input() removable = false;
  @Input() icon = '';
  @Input() pastelColor = '';
  @Input() pastelIndex = 0;

  @Output() onClick = new EventEmitter<Event>();
  @Output() onRemove = new EventEmitter<Event>();

  readonly pastelColors = [
    'var(--ktk-pastel-yellow)',
    'var(--ktk-pastel-bread)',
    'var(--ktk-pastel-pink)',
    'var(--ktk-pastel-cookie)',
    'var(--ktk-pastel-lavender)',
    'var(--ktk-pastel-green)',
  ];

  hostClasses = computed(() => {
    const classes = ['chip', `chip-${this.variant}`, `chip-${this.size}`];
    if (this.removable) classes.push('chip-removable');
    if (this.disabled) classes.push('disabled');
    return classes.join(' ');
  });

  // Expose pastel color as CSS variable
  protected get chipBg(): string {
    if (this.pastelColor) return this.pastelColor;
    return this.pastelColors[this.pastelIndex % this.pastelColors.length];
  }

  protected get chipBorder(): string {
    return this.pastelColor ? 'transparent' : 'var(--ktk-card-border)';
  }
}