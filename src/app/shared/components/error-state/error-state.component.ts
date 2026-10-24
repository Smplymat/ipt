import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { ButtonComponent } from '../button/button.component';

export type ErrorType = 'network' | 'server' | 'not-found' | 'permission' | 'validation' | 'generic';

@Component({
  selector: 'ktk-error-state',
  standalone: true,
  imports: [CommonModule, IonIcon, ButtonComponent],
  template: `
    <div class="error-state" [class.centered]="centered">
      <div class="error-icon-wrapper">
        <ion-icon [name]="errorIcon" aria-hidden="true"></ion-icon>
      </div>

      @if (title) {
        <h2 class="error-title">{{ title }}</h2>
      }

      @if (message) {
        <p class="error-message">{{ message }}</p>
      }

      @if (retryable) {
        <ktk-button
          variant="accent"
          [size]="actionSize"
          (onClick)="onRetry.emit($event)">
          <ion-icon name="refresh-outline" slot="start" aria-hidden="true"></ion-icon>
          Try Again
        </ktk-button>
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
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--ktk-space-10) var(--ktk-space-4);
      gap: var(--ktk-space-4);
    }

    .error-state.centered {
      justify-content: center;
      min-height: 300px;
    }

    .error-icon-wrapper {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--ktk-error-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ktk-error);

      ion-icon {
        font-size: 2.5rem;
      }
    }

    .error-title {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-xl);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
      margin: 0;
      line-height: 1.2;
    }

    .error-message {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-base);
      color: var(--ktk-text-secondary);
      margin: 0;
      max-width: 320px;
      line-height: 1.6;
    }
  `]
})
export class ErrorStateComponent {
  @Input() type: ErrorType = 'generic';
  @Input() title = '';
  @Input() message = '';
  @Input() retryable = true;
  @Input() actionLabel = '';
  @Input() actionRoute = '';
  @Input() actionVariant: 'primary' | 'outline' | 'accent' | 'ghost' | 'danger' = 'outline';
  @Input() actionSize: 'sm' | 'md' | 'lg' = 'md';
  @Input() centered = false;

  @Output() onRetry = new EventEmitter<Event>();
  @Output() onAction = new EventEmitter<Event>();

  get errorIcon(): string {
    const icons: Record<ErrorType, string> = {
      network: 'wifi-outline',
      server: 'server-outline',
      'not-found': 'search-outline',
      permission: 'lock-closed-outline',
      validation: 'alert-circle-outline',
      generic: 'alert-circle-outline',
    };
    return icons[this.type] || 'alert-circle-outline';
  }
}