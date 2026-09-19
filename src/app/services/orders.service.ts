import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import { CartLine } from './cart.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'online';

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  phone: string;
  address: string;
  unit_notes: string;
  latitude: number | null;
  longitude: number | null;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'paid' | 'failed';
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface NewOrderPayload {
  customer_name: string;
  phone: string;
  address: string;
  unit_notes: string;
  latitude: number | null;
  longitude: number | null;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'paid';
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
}

export const STATUS_FLOW: OrderStatus[] = ['pending', 'preparing', 'out_for_delivery', 'delivered'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on Delivery',
  online: 'Online Payment',
};

export const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'amber',
  preparing: 'blue',
  out_for_delivery: 'purple',
  delivered: 'green',
  cancelled: 'red',
};

// ─── Realtime event ──────────────────────────────────────────────────────────

export interface OrderRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Order | null;
  old: Order | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly db = inject(DatabaseService);

  private get client() {
    return this.db.client;
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  /**
   * Inserts the order row then its line items, best-effort removing the
   * order if the items insert fails (keeps the DB free of orphan orders).
   */
  async placeOrder(payload: NewOrderPayload, lines: CartLine[]): Promise<Order> {
    // RLS insert policy requires user_id = auth.uid(), so attach the caller.
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) throw new Error('You must be signed in to place an order.');
    const orderPayload = { ...payload, user_id: user.id };

    let order: Order;

    try {
      const { data, error } = await this.client
        .from('orders')
        .insert(orderPayload)
        .select()
        .single<Order>();
      if (error) throw new Error(error.message);
      order = data;

      const items = lines.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        name: l.product.name,
        price: l.product.price,
        quantity: l.quantity,
        image_url: l.product.image_url ?? '',
      }));
      const { error: itemError } = await this.client.from('order_items').insert(items);
      if (itemError) {
        await this.client.from('orders').delete().eq('id', order.id);
        throw new Error(`Order items could not be saved: ${itemError.message}`);
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Could not place your order.');
    }

    return order;
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  /** The current user's orders, newest first (RLS shows only their own). */
  async getMyOrders(): Promise<OrderWithItems[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return this.attachItems((data ?? []) as unknown as Order[]);
  }

  /** All orders (staff only) for the fulfillment dashboard. */
  async getAllOrders(): Promise<OrderWithItems[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return this.attachItems((data ?? []) as unknown as Order[]);
  }

  async getOrder(orderId: string): Promise<OrderWithItems> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single<Order>();
    if (error) throw new Error(error.message);

    const { data: items, error: itemError } = await this.client
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    if (itemError) throw new Error(itemError.message);

    return { ...data, items: (items ?? []) as unknown as OrderItem[] };
  }

  private async attachItems(orders: Order[]): Promise<OrderWithItems[]> {
    if (orders.length === 0) return [];
    const ids = orders.map((o) => o.id);
    const { data, error } = await this.client
      .from('order_items')
      .select('*')
      .in('order_id', ids);
    if (error) throw new Error(error.message);

    const byOrder = new Map<string, OrderItem[]>();
    for (const it of (data ?? []) as unknown as OrderItem[]) {
      const list = byOrder.get(it.order_id) ?? [];
      list.push(it);
      byOrder.set(it.order_id, list);
    }
    return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
  }

  // ── Status updates (staff) ────────────────────────────────────────────────────

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    const { error } = await this.client.from('orders').update({ status }).eq('id', orderId);
    if (error) throw new Error(error.message);
  }

  // ── Realtime ──────────────────────────────────────────────────────────────────

  /**
   * Subscribes to INSERT/UPDATE/DELETE on the orders table.
   * Returns an unsubscribe function. (RLS governs what the subscriber sees.)
   */
  subscribeToOrders(onChange: (event: OrderRealtimeEvent) => void): () => void {
    // Unique channel name per subscription so multiple components can listen at
    // the same time without colliding on a shared topic.
    const channel = this.client
      .channel(`orders-realtime-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          onChange({
            eventType: payload.eventType,
            new: (payload.new as Order | null) ?? null,
            old: (payload.old as Order | null) ?? null,
          });
        }
      )
      .subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  mapUrl(order: Order): string | null {
    if (order.latitude == null && order.longitude == null) return null;
    const coords = `${order.latitude},${order.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
  }
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}