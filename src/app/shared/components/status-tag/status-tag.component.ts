import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusType =
  | 'pending'
  | 'preparing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'baking'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'lowstock'
  | 'success'
  | 'error';

@Component({
  selector: 'ktk-status-tag',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="hostClasses()" [attr.aria-label]="label || type">
      {{ label || displayType }}
    </span>
  `,
  styles: [`
    .status-tag {
      display: inline-flex;
      align-items: center;
      padding: var(--ktk-space-1) var(--ktk-space-3);
      border-radius: var(--ktk-radius-button);
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-xs);
      font-weight: var(--ktk-fw-bold);
      letter-spacing: 0.3px;
      text-transform: uppercase;
      white-space: nowrap;
      border: 1px solid transparent;

      /* Pending - soft amber */
      &.status-pending {
        background: var(--ktk-status-pending);
        color: var(--ktk-text);
        border-color: rgba(245, 208, 122, 0.5);
      }

      /* Preparing - same as baking */
      &.status-preparing {
        background: var(--ktk-status-baking);
        color: var(--ktk-text);
        border-color: rgba(168, 208, 230, 0.5);
      }

      /* Out for delivery - same as ready */
      &.status-out_for_delivery {
        background: var(--ktk-status-ready);
        color: var(--ktk-text);
        border-color: rgba(184, 229, 184, 0.5);
      }

      /* Ready for pickup - same as ready */
      &.status-ready_for_pickup {
        background: var(--ktk-status-ready);
        color: var(--ktk-text);
        border-color: rgba(184, 229, 184, 0.5);
      }

      /* Baking - soft blue */
      &.status-baking {
        background: var(--ktk-status-baking);
        color: var(--ktk-text);
        border-color: rgba(168, 208, 230, 0.5);
      }

      /* Ready - soft green */
      &.status-ready {
        background: var(--ktk-status-ready);
        color: var(--ktk-text);
        border-color: rgba(184, 229, 184, 0.5);
      }

      /* Delivered - success green */
      &.status-delivered {
        background: var(--ktk-success-bg);
        color: var(--ktk-success);
        border-color: var(--ktk-success-border);
      }

      /* Cancelled - red */
      &.status-cancelled {
        background: var(--ktk-error-bg);
        color: var(--ktk-error);
        border-color: var(--ktk-error-border);
      }

      /* Low stock - amber */
      &.status-lowstock {
        background: rgba(242, 169, 0, 0.15);
        color: var(--ktk-accent-text);
        border-color: rgba(242, 169, 0, 0.35);
      }

      /* Success alias */
      &.status-success {
        background: var(--ktk-success-bg);
        color: var(--ktk-success);
        border-color: var(--ktk-success-border);
      }

      /* Error alias */
      &.status-error {
        background: var(--ktk-error-bg);
        color: var(--ktk-error);
        border-color: var(--ktk-error-border);
      }
    }
  `]
})
export class StatusTagComponent {
  @Input() type: string = 'pending';
  @Input() label = '';

  // Mapping from order statuses to display types
  private readonly typeMap: Record<string, StatusType> = {
    'pending': 'pending',
    'preparing': 'baking',
    'out_for_delivery': 'ready',
    'ready_for_pickup': 'ready',
    'delivered': 'delivered',
    'cancelled': 'cancelled',
    'lowstock': 'lowstock',
    'low_stock': 'lowstock',
  };

  private readonly displayMap: Record<StatusType, string> = {
    'pending': 'Pending',
    'preparing': 'Preparing',
    'out_for_delivery': 'Out for Delivery',
    'ready_for_pickup': 'Ready for Pickup',
    'baking': 'Preparing',
    'ready': 'Ready',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'lowstock': 'Low Stock',
    'success': 'Success',
    'error': 'Error',
  };

  hostClasses = computed(() => {
    const normalizedType = this.typeMap[this.type] || this.type;
    return `status-tag status-${normalizedType}`;
  });

  displayType = computed(() => {
    const normalizedType = this.typeMap[this.type] || this.type;
    return this.displayMap[normalizedType] || this.type;
  });
}