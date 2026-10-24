import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'ktk-category-tile',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <button
      type="button"
      class="category-tile"
      [style.background]="pastelColor()"
      (click)="onClick.emit($event)"
      [disabled]="disabled"
      [attr.aria-label]="label + (count !== undefined ? ', ' + count + ' items' : '')">
      <div class="tile-circle">
        @if (image) {
          <img [src]="image" [alt]="label" loading="lazy" (error)="onImageError($event)">
        } @else if (icon) {
          <ion-icon [name]="icon" aria-hidden="true"></ion-icon>
        }
      </div>
      <span class="tile-label">{{ label }}</span>
      @if (count !== undefined) {
        <span class="tile-count">{{ count }}</span>
      }
    </button>
  `,
  styles: [`
    .category-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ktk-space-2);
      padding: var(--ktk-space-4) var(--ktk-space-3);
      border-radius: var(--ktk-radius-tile);
      border: 2px solid transparent;
      background: var(--ktk-pastel-yellow);
      cursor: pointer;
      transition: all var(--ktk-dur-normal) var(--ktk-ease-out);
      text-align: center;
      min-width: 120px;

      &:hover:not(:disabled) {
        transform: translateY(-3px) scale(1.05);
        box-shadow: var(--ktk-shadow-card-hover);
        border-color: var(--ktk-primary);
      }

      &:active:not(:disabled) {
        transform: translateY(-1px) scale(1.02);
      }

      &:focus-visible {
        outline: var(--ktk-focus-ring-width) solid var(--ktk-focus-ring-color);
        outline-offset: var(--ktk-focus-ring-offset);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .tile-circle {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--ktk-card-bg);
        border: 2px solid var(--ktk-card-border);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: var(--ktk-shadow-sm);
        transition: all var(--ktk-dur-normal) var(--ktk-ease-out);

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        ion-icon {
          font-size: 1.75rem;
          color: var(--ktk-primary);
        }
      }

      .tile-label {
        font-family: var(--ktk-font-sans);
        font-size: var(--ktk-fs-xs);
        font-weight: var(--ktk-fw-bold);
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--ktk-text);
        line-height: 1.2;
      }

      .tile-count {
        font-family: var(--ktk-font-sans);
        font-size: var(--ktk-fs-xs);
        font-weight: var(--ktk-fw-medium);
        color: var(--ktk-text-secondary);
        background: var(--ktk-card-bg);
        padding: 2px 8px;
        border-radius: var(--ktk-radius-button);
        border: 1px solid var(--ktk-card-border);
      }
    }
  `]
})
export class CategoryTileComponent {
  @Input() label = '';
  @Input() image = '';
  @Input() icon = '';
  @Input() count: number | undefined;
  @Input() disabled = false;
  @Input() pastelIndex = 0;

  @Output() onClick = new EventEmitter<Event>();

  readonly pastelColors = [
    'var(--ktk-pastel-yellow)',
    'var(--ktk-pastel-bread)',
    'var(--ktk-pastel-pink)',
    'var(--ktk-pastel-cookie)',
    'var(--ktk-pastel-lavender)',
    'var(--ktk-pastel-green)',
  ];

  pastelColor = computed(() => this.pastelColors[this.pastelIndex % this.pastelColors.length]);

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}