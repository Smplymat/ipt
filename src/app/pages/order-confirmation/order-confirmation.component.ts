import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import {
  OrderWithItems,
  OrdersService,
  OrderStatus,
  PAYMENT_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  toErrorMessage,
} from '../../services/orders.service';

import {
  ButtonComponent,
  TicketCardComponent,
  ErrorStateComponent,
  PageHeaderComponent,
  SkeletonComponent,
} from '../../shared';

/** Maps order status to StatusTagComponent's accepted types. */
function mapStatusTag(status: OrderStatus): 'pending' | 'baking' | 'ready' | 'delivered' | 'cancelled' | 'lowstock' | 'success' | 'error' {
  switch (status) {
    case 'pending': return 'pending';
    case 'preparing': return 'baking';
    case 'out_for_delivery': return 'ready';
    case 'ready_for_pickup': return 'ready';
    case 'delivered': return 'delivered';
    case 'cancelled': return 'cancelled';
    default: return 'pending';
  }
}

@Component({
  selector: 'app-order-confirmation',
  imports: [
    RouterLink,
    IonContent,
    ButtonComponent,
    TicketCardComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './order-confirmation.component.html',
})
export class OrderConfirmationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(OrdersService);

  readonly order = signal<OrderWithItems | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly orderNumber = computed(() => {
    const o = this.order();
    return o ? o.id.replace(/-/g, '').slice(0, 10).toUpperCase() : '--------';
  });

  readonly statusLabel = STATUS_LABEL;
  readonly statusBadge = STATUS_BADGE;
  readonly paymentLabel = PAYMENT_LABEL;

  /** Maps order status to StatusTagComponent's accepted types. */
  protected mapStatusTag = mapStatusTag;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
    else this.error.set('Order reference missing.');
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const order = await this.orders.getOrder(id);
      this.order.set(order);
    } catch (err) {
      this.error.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  printReceipt(): void {
    window.print();
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  coordinates(): string {
    const o = this.order();
    return o?.latitude != null && o?.longitude != null
      ? `${o.latitude.toFixed(5)}, ${o.longitude.toFixed(5)}`
      : '—';
  }

  mapUrl(): string {
    const o = this.order();
    return o ? (this.orders.mapUrl(o) ?? '') : '';
  }

  /** Build ticket items from order items. */
  getTicketItems(order: OrderWithItems) {
    return order.items.map(item => ({
      id: item.id,
      name: item.name,
      qty: item.quantity,
      price: this.formatPrice(item.price * item.quantity),
    }));
  }

  /** Build ticket actions. */
  getTicketActions() {
    return [
      {
        label: 'Track My Orders',
        variant: 'outline' as const,
        icon: 'bag-handle-outline',
        action: 'track',
      },
    ];
  }

  onTicketAction(action: string): void {
    if (action === 'track') {
      // Navigation handled by routerLink
    }
  }

  /** Handle ticket action clicks (accepts any for template compatibility). */
  handleTicketAction(action: unknown): void {
    this.onTicketAction(action as string);
  }
}