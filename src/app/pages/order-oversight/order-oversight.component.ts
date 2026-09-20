import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  Order,
  OrdersService,
  OrderStatus,
  OrderWithItems,
  STATUS_LABEL,
  STATUS_BADGE,
} from '../../services/orders.service';
import { ProductsService, Product, toErrorMessage } from '../../services/products.service';
import { DatabaseService } from '../../services/database.service';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TableTab = 'all' | 'pending' | 'delivering' | 'finished';

export interface DonutSlice {
  label: string;
  count: number;
  color: string;
  percent: number;
  // SVG dash values computed from percent
  dasharray: string;
  dashoffset: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 54; // r = 54 on a 128×128 viewBox

const STATUS_COLORS: Record<string, string> = {
  Pending:            '#FF5B35',   // coral — project brand
  Preparing:          '#F5A623',   // amber
  'Out for Delivery': '#6B3A2A',   // brown-mid
  'Ready for Pickup': '#17A2B8',   // teal — matches STATUS_BADGE 'teal'
  Delivered:          '#3D7A55',   // green
  Cancelled:          '#C4A882',   // muted
};

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-order-oversight',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './order-oversight.component.html',
})
export class OrderOversightComponent implements OnDestroy {
  private readonly ordersService = inject(OrdersService);
  private readonly productsService = inject(ProductsService);
  private readonly db = inject(DatabaseService);

  // ── Raw data ────────────────────────────────────────────────────────────────

  readonly orders    = signal<OrderWithItems[]>([]);
  readonly products  = signal<Product[]>([]);
  readonly loading   = signal(true);
  readonly error     = signal<string | null>(null);

  // ── Table tab ───────────────────────────────────────────────────────────────

  readonly activeTab = signal<TableTab>('all');

  // ── Metric cards ────────────────────────────────────────────────────────────

  readonly totalOrders = computed(() => this.orders().length);

  readonly pendingOrders = computed(() =>
    this.orders().filter((o) => o.status === 'pending').length
  );

  readonly processingOrders = computed(() =>
    this.orders().filter((o) =>
      o.status === 'preparing' ||
      o.status === 'out_for_delivery' ||
      o.status === 'ready_for_pickup'
    ).length
  );

  readonly finishedOrders = computed(() =>
    this.orders().filter((o) => o.status === 'delivered').length
  );

  readonly totalRevenue = computed(() =>
    this.orders().filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.total), 0)
  );

  // ── Filtered table rows ─────────────────────────────────────────────────────

  readonly filteredOrders = computed(() => {
    const tab  = this.activeTab();
    const list = this.orders();
    if (tab === 'pending')    return list.filter((o) => o.status === 'pending');
    if (tab === 'delivering') return list.filter((o) =>
      o.status === 'preparing' || o.status === 'out_for_delivery' || o.status === 'ready_for_pickup'
    );
    if (tab === 'finished')   return list.filter((o) => o.status === 'delivered' || o.status === 'cancelled');
    return list;
  });

  // ── Donut chart data ────────────────────────────────────────────────────────

  readonly donutSlices = computed((): DonutSlice[] => {
    const all = this.orders();
    if (!all.length) return [];

    const counts: Record<string, number> = {};
    for (const o of all) {
      const label = STATUS_LABEL[o.status] ?? o.status;
      counts[label] = (counts[label] ?? 0) + 1;
    }

    const slices: DonutSlice[] = [];
    let offset = 0;
    for (const [label, count] of Object.entries(counts)) {
      const percent = count / all.length;
      const dash    = percent * CIRCUMFERENCE;
      const gap     = CIRCUMFERENCE - dash;
      slices.push({
        label,
        count,
        color: STATUS_COLORS[label] ?? '#C4A882',
        percent,
        dasharray:  `${dash.toFixed(2)} ${gap.toFixed(2)}`,
        dashoffset: `${(CIRCUMFERENCE - offset).toFixed(2)}`,
      });
      offset += dash;
    }
    return slices;
  });

  // ── Low-stock products (fewer than 10 would be low-stock; since we have no
  //    stock column we surface the cheapest items as "needs attention") ────────

  readonly lowStockItems = computed(() =>
    [...this.products()]
      .sort((a, b) => a.price - b.price)
      .slice(0, 5)
  );

  // ── Realtime ────────────────────────────────────────────────────────────────

  private realtimeChannel: RealtimeChannel | null = null;

  constructor() {
    void this.load();
    this.subscribeRealtime();
  }

  ngOnDestroy(): void {
    if (this.realtimeChannel) {
      void this.db.client.removeChannel(this.realtimeChannel);
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [orders, products] = await Promise.all([
        this.ordersService.getAllOrders(),
        this.productsService.list(),
      ]);
      this.orders.set(orders);
      this.products.set(products);
    } catch (err) {
      this.error.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeRealtime(): void {
    this.realtimeChannel = this.db.client
      .channel('order-oversight-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => void this.load()
      )
      .subscribe();
  }

  // ── Display helpers ─────────────────────────────────────────────────────────

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  shortId(id: string): string {
    return '#' + id.slice(0, 8).toUpperCase();
  }

  statusLabel(s: OrderStatus): string {
    return STATUS_LABEL[s] ?? s;
  }

  statusBadge(s: OrderStatus): string {
    return STATUS_BADGE[s] ?? 'amber';
  }
}
