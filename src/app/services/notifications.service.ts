import { Injectable, computed, inject, signal } from '@angular/core';
import { DatabaseService } from './database.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'order_confirmation'
  | 'order_update'
  | 'new_product'
  | 'promotion'
  | 'custom_order';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  reference_id: string | null;
  read: boolean;
  created_at: string;
}

export function notificationIcon(type: NotificationType): string {
  switch (type) {
    case 'order_confirmation':
    case 'order_update':
      return '📦';
    case 'new_product':
      return '🍞';
    case 'promotion':
      return '🏷️';
    case 'custom_order':
      return '📝';
    default:
      return '🔔';
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly db = inject(DatabaseService);

  /** The current user's inbox, newest first (signal for reactive UI). */
  readonly items = signal<AppNotification[]>([]);
  readonly loaded = signal(false);

  readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);

  /** Populates the inbox from the database (RLS scopes to the caller). */
  async refresh(): Promise<void> {
    const { data, error } = await this.db.client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    this.items.set((data ?? []) as unknown as AppNotification[]);
    this.loaded.set(true);
  }

  /** Clears the inbox when the user signs out so no stale rows are shown. */
  reset(): void {
    this.items.set([]);
    this.loaded.set(false);
  }

  /**
   * Optimistically marks a single notification as read, rolling the row back
   * and throwing if the database update fails.
   */
  async markRead(id: string): Promise<void> {
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const { error } = await this.db.client
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) {
      this.items.update((list) => list.map((n) => (n.id === id ? { ...n, read: false } : n)));
      throw new Error(error.message);
    }
  }

  /**
   * Marks every notification as read. On failure the previous read state of
   * every row is restored and the error is rethrown.
   */
  async markAllRead(): Promise<void> {
    const previous = this.items().map((n) => ({ id: n.id, read: n.read }));
    this.items.update((list) => list.map((n) => ({ ...n, read: true })));
    const { error } = await this.db.client
      .from('notifications')
      .update({ read: true })
      .eq('read', false);
    if (error) {
      this.items.update((list) =>
        list.map((n) => {
          const before = previous.find((p) => p.id === n.id);
          return before ? { ...n, read: before.read } : n;
        })
      );
      throw new Error(error.message);
    }
  }

  /**
   * Subscribes to the authenticated user's notification rows via PostgREST
   * realtime (RLS decides which rows the channel may deliver). Returns an
   * unsubscribe function.
   */
  subscribe(onChange: () => void): () => void {
    const channel = this.db.client
      .channel(`notifications-realtime-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => onChange()
      )
      .subscribe();
    return () => {
      void this.db.client.removeChannel(channel);
    };
  }
}