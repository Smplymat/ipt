import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonIcon, IonMenuButton, IonTitle, IonToolbar, ToastController } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { OrdersService, OrderWithItems, OrderStatus, STATUS_LABEL, STATUS_BADGE } from '../../../services/orders.service';
import { ProductsService, Product, toErrorMessage } from '../../../services/products.service';

import {
  ButtonComponent,
  ChipComponent,
  TicketCardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  SkeletonComponent,
  PageHeaderComponent,
} from '../../../shared';

import { addIcons } from 'ionicons';
import { searchOutline, optionsOutline, filterOutline } from 'ionicons/icons';

type StaffOrdersTab = 'all' | 'pending' | 'preparing' | 'out_for_delivery' | 'ready_for_pickup' | 'delivered' | 'cancelled';

@Component({
  selector: 'app-staff-orders',
  imports: [
    IonContent,
    IonIcon,
    ButtonComponent,
    ChipComponent,
    TicketCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
  ],
  templateUrl: './staff-orders.component.html',
  styleUrl: './staff-orders.component.scss',
})
export class StaffOrdersComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly productsService = inject(ProductsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastController);

  readonly orders = signal<OrderWithItems[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly activeTab = signal<StaffOrdersTab>('all');

  readonly statusOptions: StaffOrdersTab[] = ['all', 'pending', 'preparing', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled'];

  readonly statusLabel = STATUS_LABEL;
  readonly statusBadge = STATUS_BADGE;

  constructor() {
    addIcons({ searchOutline, optionsOutline, filterOutline });
    void this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.orders.set(await this.ordersService.getAllOrders());
    } catch (err) {
      this.error.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  readonly filteredOrders = computed(() => {
    const tab = this.activeTab();
    const list = this.orders();
    if (tab === 'all') return list;
    return list.filter(o => o.status === tab);
  });

  get emptyStateTitle(): string {
    return 'No ' + this.activeTab() + ' orders';
  }

  get emptyStateDescription(): string {
    return 'No orders with status "' + this.activeTab() + '" at the moment.';
  }

  getTabLabel(status: string): string {
    if (status === 'all') return 'All';
    return this.statusLabel[status as OrderStatus] || status;
  }

  nextStatus(order: OrderWithItems): OrderStatus | null {
    const flow: OrderStatus[] = order.fulfillment_type === 'pickup'
      ? ['pending', 'preparing', 'ready_for_pickup', 'delivered']
      : ['pending', 'preparing', 'out_for_delivery', 'delivered'];
    const idx = flow.indexOf(order.status);
    if (idx === -1 || idx >= flow.length - 1) return null;
    return flow[idx + 1] as OrderStatus;
  }

  async advanceStatus(order: OrderWithItems): Promise<void> {
    const next = this.nextStatus(order);
    if (!next) return;
    try {
      await this.ordersService.updateStatus(order.id, next);
      this.orders.update(list => list.map(o => o.id === order.id ? { ...o, status: next } : o));
    } catch (err) {
      this.error.set(toErrorMessage(err));
    }
  }

  async cancelOrder(order: OrderWithItems): Promise<void> {
    try {
      await this.ordersService.updateStatus(order.id, 'cancelled');
      this.orders.update(list => list.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o));
    } catch (err) {
      this.error.set(toErrorMessage(err));
    }
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  shortId(order: OrderWithItems): string {
    return '#' + order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  paymentLabel(method: string): string {
    const labels: Record<string, string> = {
      cod: 'Cash on Delivery',
      card: 'Credit/Debit Card',
      gcash: 'GCash',
      paymaya: 'Maya',
      grab_pay: 'GrabPay',
    };
    return labels[method] ?? method;
  }

  fulfillmentLabel(order: OrderWithItems): string {
    return order.fulfillment_type === 'pickup' ? 'Pickup' : 'Delivery';
  }

  scheduleLabel(order: OrderWithItems): string {
    if (!order.scheduled_at) return 'ASAP';
    const d = new Date(order.scheduled_at);
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  getTicketActions(order: OrderWithItems) {
    const actions = [];

    const next = this.nextStatus(order);
    if (next && order.status !== 'cancelled' && order.status !== 'delivered') {
      actions.push({
        label: 'Mark as ' + this.statusLabel[next],
        variant: 'accent' as const,
        icon: 'checkmark-outline',
        action: 'advance',
      });
    }
    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      actions.push({
        label: 'Cancel',
        variant: 'danger' as const,
        icon: 'close-outline',
        action: 'cancel',
      });
    }
    return actions;
  }

  handleAction(action: string, order: OrderWithItems): void {
    switch (action) {
      case 'advance':
        this.advanceStatus(order);
        break;
      case 'cancel':
        this.cancelOrder(order);
        break;
    }
  }
}