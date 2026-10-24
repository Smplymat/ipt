import { Component, Input, Output, EventEmitter, HostListener, inject, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton } from '@ionic/angular';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'ktk-bottom-sheet',
  standalone: true,
  imports: [CommonModule, IonIcon, IonButton],
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="sheet-backdrop"
        [class.desktop]="isDesktop()"
        (click)="onBackdropClick()"
        @fadeInOut>
      </div>

      <!-- Sheet / Modal -->
      <div
        class="sheet-container"
        [class.desktop]="isDesktop()"
        [class.full-height]="fullHeight"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="descriptionId"
        @slideInOut>

        <!-- Drag handle (mobile only) -->
        @if (!isDesktop()) {
          <div class="sheet-handle" aria-hidden="true">
            <div class="handle-bar"></div>
          </div>
        }

        <!-- Header -->
        @if (title || showClose) {
          <header class="sheet-header">
            @if (title) {
              <h2 id="{{ titleId }}" class="sheet-title">{{ title }}</h2>
            }
            @if (showClose) {
              <ion-button
                fill="clear"
                size="small"
                class="sheet-close"
                (click)="close.emit()"
                aria-label="Close">
                <ion-icon name="close-outline" slot="icon-only" aria-hidden="true"></ion-icon>
              </ion-button>
            }
          </header>
        }

        <!-- Content -->
        <div class="sheet-content" [class.has-header]="title || showClose">
          <ng-content></ng-content>
        </div>

        <!-- Footer actions -->
        @if (showFooter) {
          <footer class="sheet-footer">
            <ng-content select="[sheet-footer]"></ng-content>
          </footer>
        }
      </div>
    }
  `,
  styles: [`
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(42, 26, 16, 0.4);
      z-index: var(--ktk-z-modal-backdrop);
      opacity: 0;
      transition: opacity var(--ktk-dur-normal) var(--ktk-ease-out);

      &.visible {
        opacity: 1;
      }

      &.desktop {
        background: rgba(42, 26, 16, 0.5);
        backdrop-filter: blur(4px);
      }
    }

    .sheet-container {
      position: fixed;
      z-index: var(--ktk-z-modal);
      display: flex;
      flex-direction: column;
      background: var(--ktk-card-bg);
      border-radius: var(--ktk-radius-sheet) var(--ktk-radius-sheet) 0 0;
      box-shadow: var(--ktk-shadow-sheet);
      max-height: 90vh;
      overflow: hidden;
      transform: translateY(100%);
      transition: transform var(--ktk-dur-normal) var(--ktk-ease-spring);

      &.visible {
        transform: translateY(0);
      }

      /* Desktop: centered modal */
      &.desktop {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        border-radius: var(--ktk-radius-sheet);
        max-width: 560px;
        width: 90vw;
        max-height: 85vh;

        &.visible {
          transform: translate(-50%, -50%) scale(1);
        }

        &.full-height {
          max-height: 90vh;
        }
      }

      /* Mobile: bottom sheet */
      &:not(.desktop) {
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        max-height: 85vh;
        border-radius: var(--ktk-radius-sheet) var(--ktk-radius-sheet) 0 0;

        &.full-height {
          max-height: 90vh;
        }
      }

      .sheet-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--ktk-space-2) 0;
        cursor: grab;
        -webkit-app-region: drag;

        .handle-bar {
          width: var(--ktk-sheet-handle-width);
          height: var(--ktk-sheet-handle-height);
          background: var(--ktk-muted-beige);
          border-radius: var(--ktk-sheet-handle-radius);
        }
      }

      .sheet-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ktk-space-3) var(--ktk-space-4);
        border-bottom: 1px solid var(--ktk-card-border);
        flex-shrink: 0;
      }

      .sheet-title {
        font-family: var(--ktk-font-serif);
        font-size: var(--ktk-fs-xl);
        font-weight: var(--ktk-fw-extrabold);
        color: var(--ktk-text);
        margin: 0;
      }

      .sheet-close {
        --color: var(--ktk-text-muted);
        --color-hover: var(--ktk-error);
        min-width: 40px;
        min-height: 40px;
      }

      .sheet-content {
        flex: 1;
        overflow-y: auto;
        padding: var(--ktk-space-4);
        -webkit-overflow-scrolling: touch;

        &.has-header {
          padding-top: var(--ktk-space-4);
        }
      }

      .sheet-footer {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ktk-space-2);
        padding: var(--ktk-space-3) var(--ktk-space-4);
        border-top: 1px solid var(--ktk-card-border);
        background: var(--ktk-base-tint);
        flex-shrink: 0;
      }
    }

    /* Animations */
    @keyframes ktk-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes ktk-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes ktk-slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    @keyframes ktk-slide-down {
      from { transform: translateY(0); }
      to { transform: translateY(100%); }
    }
    @keyframes ktk-modal-in {
      from { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
      to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @keyframes ktk-modal-out {
      from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      to { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
    }
  `],
  animations: []
})
export class BottomSheetComponent {
  private platform = inject(Platform);

  @Input() title = '';
  @Input() showClose = true;
  @Input() showFooter = false;
  @Input() fullHeight = false;
  @Input() closeOnBackdrop = true;

  @Output() close = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  readonly isOpen = signal(false);
  readonly isDesktop = signal(false);

  titleId = `sheet-title-${Math.random().toString(36).slice(2)}`;
  descriptionId = `sheet-desc-${Math.random().toString(36).slice(2)}`;

  constructor() {
    effect(() => {
      const width = this.platform.width();
      this.isDesktop.set(typeof width === 'number' ? width >= 992 : false);
    });

    // Listen for resize
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const width = this.platform.width();
    this.isDesktop.set(typeof width === 'number' ? width >= 992 : false);
  };

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) this.close.emit();
  }

  open(): void {
    this.isOpen.set(true);
    // Prevent body scroll on mobile
    if (!this.isDesktop()) {
      document.body.style.overflow = 'hidden';
    }
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop) {
      this.close.emit();
    }
  }

  // Called by parent after close animation
  onDismissed(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
    this.dismissed.emit();
  }
}