import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { ButtonComponent } from '../button/button.component';

export type EmptyStateIllustration = 'cart' | 'search' | 'orders' | 'notifications' | 'reviews' | 'custom' | 'wifi' | 'box';

@Component({
  selector: 'ktk-empty-state',
  standalone: true,
  imports: [CommonModule, IonIcon, ButtonComponent],
  template: `
    <div class="empty-state" [class.centered]="centered">
      <div class="illustration-wrapper" [class.custom]="illustration === 'custom'">
        @if (illustration === 'custom' && customIcon) {
          <span class="custom-icon">{{ customIcon }}</span>
        } @else {
          <ion-icon [name]="illustrationIcon" aria-hidden="true"></ion-icon>
        }
      </div>

      @if (title) {
        <h2 class="empty-title">{{ title }}</h2>
      }

      @if (description) {
        <p class="empty-description">{{ description }}</p>
      }

      @if (actionLabel && actionRoute) {
        <ktk-button
          [variant]="actionVariant"
          [size]="actionSize"
          [routerLink]="actionRoute">
          {{ actionLabel }}
        </ktk-button>
      } @else if (actionLabel && !actionRoute) {
        <ktk-button
          [variant]="actionVariant"
          [size]="actionSize"
          (onClick)="onAction.emit($event)">
          {{ actionLabel }}
        </ktk-button>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--ktk-space-10) var(--ktk-space-4);
      gap: var(--ktk-space-4);
    }

    .empty-state.centered {
      justify-content: center;
      min-height: 300px;
    }

    .illustration-wrapper {
      width: 100px;
      height: 100px;
      border-radius: var(--ktk-radius-tile);
      background: var(--ktk-muted-beige);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ktk-text-muted);
      opacity: 0.8;

      &.custom {
        background: transparent;
      }

      ion-icon {
        font-size: 3rem;
      }

      .custom-icon {
        font-size: 3rem;
      }
    }

    .empty-title {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-xl);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
      margin: 0;
      line-height: 1.2;
    }

    .empty-description {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-base);
      color: var(--ktk-text-secondary);
      margin: 0;
      max-width: 280px;
      line-height: 1.6;
    }
  `]
})
export class EmptyStateComponent {
  @Input() illustration: EmptyStateIllustration = 'box';
  @Input() customIcon = '';
  @Input() title = '';
  @Input() description = '';
  @Input() actionLabel = '';
  @Input() actionRoute = '';
  @Input() actionVariant: 'primary' | 'outline' | 'accent' | 'ghost' | 'danger' = 'accent';
  @Input() actionSize: 'sm' | 'md' | 'lg' = 'md';
  @Input() centered = false;

  @Output() onAction = new EventEmitter<Event>();

  get illustrationIcon(): string {
    const icons: Record<EmptyStateIllustration, string> = {
      cart: 'cart-outline',
      search: 'search-outline',
      orders: 'receipt-outline',
      notifications: 'notifications-outline',
      reviews: 'star-outline',
      custom: 'cube-outline',
      wifi: 'wifi-outline',
      box: 'cube-outline',
    };
    return icons[this.illustration] || 'cube-outline';
  }
}