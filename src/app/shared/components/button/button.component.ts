import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export type ButtonVariant = 'primary' | 'outline' | 'accent' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ktk-button',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (routerLink) {
      <a
        [routerLink]="routerLink"
        [class]="hostClasses()"
        [attr.aria-disabled]="disabled"
        [attr.tabindex]="disabled ? -1 : 0"
        (click)="disabled && $event.preventDefault()"
        (keydown.enter)="disabled && $event.preventDefault()">
        <ng-content></ng-content>
      </a>
    } @else {
      <button
        [type]="type"
        [class]="hostClasses()"
        [disabled]="disabled"
        (click)="onClick.emit($event)">
        <ng-content></ng-content>
      </button>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ktk-space-2);
      font-family: var(--ktk-font-sans);
      font-weight: var(--ktk-fw-bold);
      border-radius: var(--ktk-radius-button);
      border: var(--ktk-border-width-bold) solid transparent;
      cursor: pointer;
      transition: all var(--ktk-dur-fast) var(--ktk-ease-out);
      text-decoration: none;
      white-space: nowrap;
      user-select: none;
      min-height: var(--ktk-btn-height);
      padding: 0 var(--ktk-btn-padding-x);
      box-shadow: var(--ktk-shadow-button);

      /* Sizes */
      &.btn-sm {
        min-height: var(--ktk-btn-height-sm);
        padding: 0 var(--ktk-btn-padding-x-sm);
        font-size: var(--ktk-fs-sm);
      }

      &.btn-lg {
        min-height: var(--ktk-btn-height-lg);
        padding: 0 var(--ktk-btn-padding-x-lg);
        font-size: var(--ktk-fs-lg);
      }

      &:not(.btn-sm):not(.btn-lg) {
        font-size: var(--ktk-fs-base);
        padding: 0 var(--ktk-btn-padding-x);
      }

      /* Variants */
      &.btn-primary {
        background: var(--ktk-primary);
        color: var(--ktk-primary-contrast);
        border-color: var(--ktk-primary);

        &:hover:not(:disabled) {
          background: var(--ktk-primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 5px 0 var(--ktk-primary);
        }

        &:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: none;
        }
      }

      &.btn-outline {
        background: transparent;
        color: var(--ktk-primary);
        border-color: var(--ktk-primary);

        &:hover:not(:disabled) {
          background: var(--ktk-primary);
          color: var(--ktk-primary-contrast);
        }
      }

      &.btn-accent {
        background: var(--ktk-accent);
        color: var(--ktk-text-on-accent);
        border-color: var(--ktk-accent);
        box-shadow: var(--ktk-shadow-button-accent);

        &:hover:not(:disabled) {
          background: var(--ktk-accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 5px 0 var(--ktk-accent-active);
        }

        &:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: none;
        }
      }

      &.btn-ghost {
        background: transparent;
        color: var(--ktk-text);
        border-color: transparent;
        box-shadow: none;

        &:hover:not(:disabled) {
          background: var(--ktk-muted-beige);
        }
      }

      &.btn-danger {
        background: var(--ktk-error);
        color: #FFFFFF;
        border-color: var(--ktk-error);
        box-shadow: 0 3px 0 var(--ktk-error);

        &:hover:not(:disabled) {
          background: #A83226;
          transform: translateY(-2px);
          box-shadow: 0 5px 0 #A83226;
        }

        &:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: none;
        }
      }

      /* Disabled state */
      &:disabled,
      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }

      /* Full width */
      &.btn-block {
        width: 100%;
      }

      /* Loading state */
      &.btn-loading {
        position: relative;
        color: transparent !important;

        &::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: ktk-spin 0.6s linear infinite;
        }
      }

      @keyframes ktk-spin {
        to { transform: rotate(360deg); }
      }

      /* Focus visible */
      &:focus-visible {
        outline: var(--ktk-focus-ring-width) solid var(--ktk-focus-ring-color);
        outline-offset: var(--ktk-focus-ring-offset);
      }

      /* Icon sizing */
      ion-icon {
        font-size: 1.125em;
        flex-shrink: 0;
      }
    }
  `]
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() block = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() routerLink: string | string[] = '';
  @Input() expand = false;

  @Output() onClick = new EventEmitter<Event>();

  hostClasses = computed(() => {
    const classes = ['btn', `btn-${this.variant}`, `btn-${this.size}`];
    if (this.block) classes.push('btn-block');
    if (this.loading) classes.push('btn-loading');
    if (this.disabled) classes.push('disabled');
    return classes.join(' ');
  });
}