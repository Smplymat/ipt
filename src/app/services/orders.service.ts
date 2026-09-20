import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import { CartLine } from './cart.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'online';
export type FulfillmentType = 'delivery' | 'pickup';

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  phone: string;
  fulfillment_type: FulfillmentType;
  address: string;
  unit_notes: string;
  latitude: number | null;
  longitude: number | null;
  scheduled_at: string | null;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'paid' | 'failed';
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  discount: number;
  voucher_code: string | null;
  voucher_id: string | null;
  status: OrderStatus;
  stock_restored: boolean;
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

/** One cart line sent to the server (the server reads price/stock itself). */
export interface PlaceOrderParams {
  customer_name: string;
  phone: string;
  fulfillment_type: FulfillmentType;
  address: string;
  unit_notes: string;
  latitude: number | null;
  longitude: number | null;
  scheduled_at: string | null;
  payment_method: PaymentMethod;
  promo_code?: string | null;
}

export interface NewCustomOrderPayload {
  name: string;
  phone: string;
  description: string;
  quantity: number;
  /** ISO date string, or null when no deadline was given. */
  deadline: string | null;
}

export const STATUS_FLOW_DELIVERY: OrderStatus[] = ['pending', 'preparing', 'out_for_delivery', 'delivered'];
export const STATUS_FLOW_PICKUP: OrderStatus[] = ['pending', 'preparing', 'ready_for_pickup', 'delivered'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  ready_for_pickup: 'Ready for Pickup',
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
  ready_for_pickup: 'teal',
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
   * Places an order by calling the SECURITY DEFINER `place_order` database
   * function. The client only sends cart lines (product_id + quantity) and the
   * address/fulfillment details — prices, stock, totals, tax, discounts and
   * voucher redemption are all computed and validated server-side inside one
   * transaction. The function returns the created order.
   */
  async placeOrder(params: PlaceOrderParams, lines: CartLine[]): Promise<Order> {
    const { data, error } = await this.client.rpc('place_order', {
      p_customer_name: params.customer_name,
      p_phone: params.phone,
      p_fulfillment_type: params.fulfillment_type,
      p_address: params.address,
      p_unit_notes: params.unit_notes,
      p_latitude: params.latitude,
      p_longitude: params.longitude,
      p_scheduled_at: params.scheduled_at,
      p_payment_method: params.payment_method,
      p_cart: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      p_promo_code: params.promo_code ?? null,
    });
    if (error) throw new Error(error.message);
    return data as unknown as Order;
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  /**
   * Fetches orders from the database, newest first.
   * RLS automatically scopes the result to the current user's own orders;
   * staff (with a permissive policy) receive all orders.
   */
  async getOrders(): Promise<OrderWithItems[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return this.attachItems((data ?? []) as unknown as Order[]);
  }

  /** @deprecated Use getOrders() — RLS scopes the result automatically. */
  async getMyOrders(): Promise<OrderWithItems[]> {
    return this.getOrders();
  }

  /** @deprecated Use getOrders() — RLS scopes the result automatically. */
  async getAllOrders(): Promise<OrderWithItems[]> {
    return this.getOrders();
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

  /**
   * Submits a custom / bespoke order request (wedding cakes, bulk bakes, etc.).
   * The row is tied to the caller; staff get a notification via DB trigger.
   */
  async placeCustomOrder(payload: NewCustomOrderPayload): Promise<void> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) throw new Error('You must be signed in to send a custom order request.');
    const { error } = await this.client
      .from('custom_orders')
      .insert({ ...payload, user_id: user.id });
    if (error) throw new Error(error.message);
  }

  // ── Status updates (staff) ────────────────────────────────────────────────────

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    const { error } = await this.client.from('orders').update({ status }).eq('id', orderId);
    if (error) throw new Error(error.message);
  }

  // ── Customer cancel (pending orders only) ─────────────────────────────────────

  /**
   * Allows the order owner to cancel their own order while it is still
   * in 'pending' status. The RLS policy enforces the same constraint on
   * the server side, so this is safe even without a cloud function.
   */
  async cancelMyOrder(orderId: string): Promise<void> {
    const { error } = await this.client
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('status', 'pending'); // belt-and-suspenders guard
    if (error) throw new Error(error.message);
  }

  /** Returns the next status step given the order's fulfillment type. */
  nextStatusFor(order: Order): OrderStatus | null {
    const flow = order.fulfillment_type === 'pickup'
      ? STATUS_FLOW_PICKUP
      : STATUS_FLOW_DELIVERY;
    const idx = flow.indexOf(order.status);
    if (idx === -1 || idx >= flow.length - 1) return null;
    return flow[idx + 1];
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