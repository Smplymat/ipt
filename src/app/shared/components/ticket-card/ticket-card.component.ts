import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { StatusTagComponent } from '../status-tag/status-tag.component';
import { ButtonComponent } from '../button/button.component';

export interface TicketAction {
  label: string;
  variant: 'primary' | 'outline' | 'accent' | 'ghost' | 'danger';
  icon?: string;
  action: string;
  disabled?: boolean;
}

@Component({
  selector: 'ktk-ticket-card',
  standalone: true,
  imports: [CommonModule, IonIcon, StatusTagComponent, ButtonComponent],
  template: `
    <article class="ticket-card" [class.compact]="compact">
      <!-- Dashed notch top edge -->
      <div class="ticket-notch" aria-hidden="true"></div>

      <div class="ticket-body">
        <!-- Header with status -->
        <div class="ticket-header">
          <div class="ticket-title-row">
            @if (title) {
              <h3 class="ticket-title">{{ title }}</h3>
            }
            @if (subtitle) {
              <p class="ticket-subtitle">{{ subtitle }}</p>
            }
          </div>
          @if (status) {
            <ktk-status-tag [type]="status"></ktk-status-tag>
          }
        </div>

        <!-- Meta/info rows -->
        @if (metaRows.length > 0) {
          <div class="ticket-meta">
            @for (row of metaRows; track row.label) {
              <div class="meta-row">
                <span class="meta-label">{{ row.label }}</span>
                <span class="meta-value" [class.highlight]="row.highlight">{{ row.value }}</span>
              </div>
            }
          </div>
        }

        <!-- Divider -->
        @if (showDivider) {
          <div class="ticket-divider" aria-hidden="true"></div>
        }

        <!-- Items list (for orders) -->
        @if (items.length > 0) {
          <div class="ticket-items">
            @for (item of items; track item.id) {
              <div class="ticket-item">
                <div class="item-info">
                  <span class="item-qty">×{{ item.qty }}</span>
                  <span class="item-name">{{ item.name }}</span>
                </div>
                <span class="item-price">{{ item.price }}</span>
              </div>
            }
          </div>
        }

        <!-- Actions -->
        @if (actions.length > 0) {
          <div class="ticket-actions">
            @for (action of actions; track action.action) {
              <ktk-button
                [variant]="action.variant"
                size="sm"
                [disabled]="action.disabled ?? false"
                (onClick)="onAction.emit(action.action)">
                @if (action.icon) {
                  <ion-icon [name]="action.icon" slot="start" aria-hidden="true"></ion-icon>
                }
                {{ action.label }}
              </ktk-button>
            }
          </div>
        }
      </div>
    </article>
  `,
  styles: [`
    .ticket-card {
      background: var(--ktk-card-bg);
      border: 1px solid var(--ktk-card-border);
      border-radius: var(--ktk-radius-card);
      box-shadow: var(--ktk-shadow-card);
      overflow: hidden;
      position: relative;

      &.compact {
        .ticket-body { padding: var(--ktk-space-3); }
        .ticket-title { font-size: var(--ktk-fs-lg); }
        .ticket-subtitle { font-size: var(--ktk-fs-sm); }
      }
    }

    /* Dashed notch top edge */
    .ticket-notch {
      height: 8px;
      background: repeating-linear-gradient(
        90deg,
        var(--ktk-card-border) 0,
        var(--ktk-card-border) 10px,
        transparent 10px,
        transparent 20px
      );
      border-radius: var(--ktk-radius-card) var(--ktk-radius-card) 0 0;
    }

    .ticket-body {
      padding: var(--ktk-space-4);
    }

    .ticket-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--ktk-space-3);
      margin-bottom: var(--ktk-space-3);
      flex-wrap: wrap;
    }

    .ticket-title-row {
      flex: 1;
      min-width: 0;
    }

    .ticket-title {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-xl);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
      margin: 0 0 var(--ktk-space-1);
      line-height: 1.2;
    }

    .ticket-subtitle {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      color: var(--ktk-text-secondary);
      margin: 0;
      line-height: 1.4;
    }

    .ticket-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--ktk-space-2) var(--ktk-space-4);
      margin-bottom: var(--ktk-space-3);
      padding-bottom: var(--ktk-space-3);
      border-bottom: 1px solid var(--ktk-card-border);
    }

    .meta-row {
      display: flex;
      flex-direction: column;
      gap: var(--ktk-space-1);
    }

    .meta-label {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-xs);
      font-weight: var(--ktk-fw-bold);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--ktk-text-muted);
    }

    .meta-value {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      color: var(--ktk-text);
      font-weight: var(--ktk-fw-medium);

      &.highlight {
        font-family: var(--ktk-font-serif);
        font-weight: var(--ktk-fw-extrabold);
        color: var(--ktk-primary);
      }
    }

    .ticket-divider {
      height: 1px;
      background: var(--ktk-card-border);
      margin: var(--ktk-space-3) 0;
    }

    .ticket-items {
      display: flex;
      flex-direction: column;
      gap: var(--ktk-space-2);
      margin-bottom: var(--ktk-space-3);
    }

    .ticket-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--ktk-space-2) 0;
      border-bottom: 1px dashed var(--ktk-card-border);

      &:last-child {
        border-bottom: none;
      }
    }

    .item-info {
      display: flex;
      align-items: center;
      gap: var(--ktk-space-2);
      min-width: 0;
    }

    .item-qty {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      font-weight: var(--ktk-fw-bold);
      color: var(--ktk-primary);
      background: var(--ktk-muted-beige);
      padding: 2px 8px;
      border-radius: var(--ktk-radius-small);
    }

    .item-name {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      color: var(--ktk-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-price {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-sm);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
      white-space: nowrap;
    }

    .ticket-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ktk-space-2);
      padding-top: var(--ktk-space-2);
      border-top: 1px solid var(--ktk-card-border);
    }
  `]
})
export class TicketCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() status: string = '';
  @Input() metaRows: { label: string; value: string; highlight?: boolean }[] = [];
  @Input() items: { id: string; name: string; qty: number; price: string }[] = [];
  @Input() actions: TicketAction[] = [];
  @Input() showDivider = true;
  @Input() compact = false;

  @Output() onAction = new EventEmitter<string>();
}