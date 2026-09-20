import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonMenuButton,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import {
  OrderWithItems,
  OrdersService,
  OrderStatus,
  STATUS_BADGE,
  STATUS_FLOW_DELIVERY,
  STATUS_FLOW_PICKUP,
  STATUS_LABEL,
  toErrorMessage,
} from '../../services/orders.service';

@Component({
  selector: 'app-orders',
  imports: [
    CommonModule,
    RouterLink,
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonMenuButton,
    IonRow,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly ordersService = inject(OrdersService);
  private readonly alertCtrl = inject(AlertController);

  readonly statusLabel = STATUS_LABEL;
  readonly statusBadge = STATUS_BADGE;

  readonly tab = signal<'orders' | 'cart'>('orders');

  // Fulfillment mode: staff see every customer's order + status controls.
  readonly isStaff = computed(() => this.auth.canManageProducts());

  readonly orders = signal<OrderWithItems[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // ── Stats (live) ───────────────────────────────────────────────────────────
  readonly stats = computed(() => {
    const list = this.orders();
    const active = list.filter((o) => o.status !== 'cancelled');
    const inProgress = list.filter((o) =>
      ['pending', 'preparing', 'out_for_delivery', 'ready_for_pickup'].includes(o.status)
    ).length;
    const spent = active.reduce((sum, o) => sum + Number(o.total), 0);
    return [
      { value: String(list.length), label: 'Total Orders' },
      { value: String(inProgress), label: 'In Progress' },
      { value: `₱${spent.toFixed(0)}`, label: this.isStaff() ? 'Order Value' : 'Total Spent' },
      {
        value: list.length ? `₱${(spent / list.length).toFixed(0)}` : '₱0',
        label: 'Avg. Order',
      },
    ];
  });

  // ── Cart (shared service) ──────────────────────────────────────────────────
  readonly lines = this.cart.lines;
  readonly subtotal = this.cart.subtotal;
  readonly deliveryFee = this.cart.deliveryFee;
  readonly tax = this.cart.tax;
  readonly total = this.cart.total;
  readonly itemCount = this.cart.itemCount;

  private unsubscribeRealtime: (() => void) | null = null;

  constructor() {
    void this.loadOrders();
    // Live updates: staff see new/updated orders instantly; customers see
    // their own status change the moment staff push it.
    this.unsubscribeRealtime = this.ordersService.subscribeToOrders(() => {
      void this.loadOrders();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeRealtime?.();
  }

  async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const list = this.isStaff()
        ? await this.ordersService.getAllOrders()
        : await this.ordersService.getMyOrders();
      this.orders.set(list);
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  adjustQty(productId: string, delta: number): void {
    const current = this.lines().find((l) => l.product.id === productId)?.quantity ?? 0;
    this.cart.setQuantity(productId, current + delta);
  }

  // ── Staff fulfillment controls ───────────────────────────────────────────────

  /** Next step in the correct status flow based on the order's fulfillment type. */
  nextStatus(order: OrderWithItems): OrderStatus | null {
    const flow = order.fulfillment_type === 'pickup'
      ? STATUS_FLOW_PICKUP
      : STATUS_FLOW_DELIVERY;
    const idx = flow.indexOf(order.status);
    if (idx === -1 || idx >= flow.length - 1) return null;
    return flow[idx + 1];
  }

  async advanceStatus(order: OrderWithItems): Promise<void> {
    const next = this.nextStatus(order);
    if (!next) return;
    try {
      await this.ordersService.updateStatus(order.id, next);
      this.reloadAfterUpdate(order.id, next);
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    }
  }

  async cancelOrder(order: OrderWithItems): Promise<void> {
    try {
      await this.ordersService.updateStatus(order.id, 'cancelled');
      this.reloadAfterUpdate(order.id, 'cancelled');
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    }
  }

  // ── Customer cancel (pending orders only) ────────────────────────────────────

  /** Returns true only while the customer is still allowed to self-cancel. */
  canCustomerCancel(order: OrderWithItems): boolean {
    return !this.isStaff() && order.status === 'pending';
  }

  async cancelMyOrder(order: OrderWithItems): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cancel order?',
      message: `Order #${this.shortId(order)} is still pending. Cancel it now?`,
      buttons: [
        { text: 'Keep order', role: 'cancel' },
        {
          text: 'Yes, cancel',
          role: 'destructive',
          handler: async () => {
            try {
              await this.ordersService.cancelMyOrder(order.id);
              this.reloadAfterUpdate(order.id, 'cancelled');
            } catch (err) {
              this.errorMessage.set(toErrorMessage(err));
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private reloadAfterUpdate(orderId: string, status: OrderStatus): void {
    this.orders.update((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  }

  // ── Shared formatting/helpers ───────────────────────────────────────────────

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  mapUrl(order: OrderWithItems): string {
    return this.ordersService.mapUrl(order) ?? '';
  }

  shortId(order: OrderWithItems): string {
    return order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  coords(order: OrderWithItems): string {
    return order.latitude != null && order.longitude != null
      ? `${order.latitude.toFixed(5)}, ${order.longitude.toFixed(5)}`
      : 'No pin set';
  }

  paymentLabel(order: OrderWithItems): string {
    return order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment';
  }

  fulfillmentLabel(order: OrderWithItems): string {
    return order.fulfillment_type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery';
  }

  scheduleLabel(order: OrderWithItems): string {
    if (!order.scheduled_at) return 'ASAP';
    const d = new Date(order.scheduled_at);
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}