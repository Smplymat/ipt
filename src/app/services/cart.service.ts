import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Product } from './products.service';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import {
  voucherDiscountAmount,
  voucherIssue,
  type Voucher,
} from './vouchers.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface AddToCartResult {
  success: boolean;
  message?: string;
  quantity?: number;
}

// ─── Pricing config ──────────────────────────────────────────────────────────

export const DELIVERY_FEE = 60;
export const FREE_DELIVERY_THRESHOLD = 500;
export const TAX_RATE = 0.12;

const CART_STORAGE_KEY = 'knead-to-know:cart';
const VOUCHER_STORAGE_KEY = 'knead-to-know:voucher';

/** Highest quantity the cart should accept for a product given its stock. */
function maxQty(product: Product): number {
  return Math.max(0, Number(product.stock_quantity) || 0);
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateProduct(product: Product): string | null {
  if (!product || typeof product !== 'object') return 'Invalid product.';
  if (!product.id || typeof product.id !== 'string') return 'Product ID is missing.';
  if (!product.name || typeof product.name !== 'string') return 'Product name is missing.';
  if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) {
    return 'Product price is invalid.';
  }
  return null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Persistent shopping cart with dual backend:
 *  - Logged-in users → Supabase `cart_items` table (real-time, multi-device)
 *  - Guests → localStorage (session-only)
 *
 * On login, guest cart is merged into the user's server cart.
 * On logout, server cart is cleared from memory (user can log in again to restore).
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly auth = inject(AuthService);
  private readonly db = inject(DatabaseService);

  /** Flat list of lines (max 1 line per product). */
  readonly lines = signal<CartLine[]>([]);

  /** Storage key in effect the last time the cart was (re)loaded. */
  private activeKey = '';

  /** The voucher the user picked for this cart (kept in sync with the cart). */
  readonly selectedVoucher = signal<Voucher | null>(null);

  /** Loading state for async operations. */
  readonly loading = signal(false);

  readonly itemCount = computed(() =>
    this.lines().reduce((sum, line) => sum + line.quantity, 0)
  );

  readonly subtotal = computed(() =>
    this.lines().reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  );

  readonly deliveryFee = computed(() => {
    const subtotal = this.subtotal();
    return subtotal > 0 && subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  });

  /** Why the selected voucher cannot be applied, or null when it is usable. */
  readonly voucherNote = computed(() => voucherIssue(this.selectedVoucher(), this.lines()));

  /** ₱ discount of the selected voucher against the current cart (0 if not usable). */
  readonly discount = computed(() =>
    this.selectedVoucher() && !this.voucherNote()
      ? voucherDiscountAmount(this.selectedVoucher()!, this.lines())
      : 0
  );

  /** Subtotal after the discount — tax is charged on this basis. */
  readonly taxable = computed(() => Math.max(0, this.subtotal() - this.discount()));

  readonly tax = computed(() => this.taxable() * TAX_RATE);

  readonly total = computed(
    () => this.taxable() + this.deliveryFee() + this.tax()
  );

  constructor() {
    // Initial load for whatever identity is current (guest or user).
    this.activeKey = this.storageKey();
    this.lines.set(this.loadLocal());
    this.selectedVoucher.set(this.loadVoucherLocal());

    // React to auth changes: switch storage key, merge guest→user on login.
    effect(() => {
      const key = this.storageKey();
      const user = this.auth.user();

      if (key !== this.activeKey) {
        const wasGuest = !this.activeKey.includes(':');
        const nowUser = !!user;

        this.activeKey = key;

        if (wasGuest && nowUser) {
          // Login detected: merge guest localStorage into Supabase, then load server cart.
          void this.mergeGuestCartAndLoadServer();
        } else {
          // Logout or user switch: just load the new key's cart.
          this.loadForCurrentKey();
        }
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Adds a product to the cart.
   * - Validates product and stock
   * - Increments quantity if already present
   * - Persists to Supabase (logged-in) or localStorage (guest)
   * - Returns success/failure with a user-facing message.
   */
  async addToCart(product: Product, quantity = 1): Promise<AddToCartResult> {
    const validationError = validateProduct(product);
    if (validationError) {
      return { success: false, message: validationError };
    }

    const max = maxQty(product);
    if (max === 0) {
      return { success: false, message: `${product.name} is sold out.` };
    }

    const requestedQty = Math.max(1, Math.min(quantity, max));
    const user = this.auth.user();
    const isLoggedIn = !!user;

    this.loading.set(true);
    try {
      if (isLoggedIn) {
        await this.addToServerCart(user.id, product.id, requestedQty, max);
      } else {
        this.addToLocalCart(product, requestedQty, max);
      }

      const newQty = this.getLineQuantity(product.id);
      return { success: true, message: `${product.name} added to cart`, quantity: newQty };
    } catch (err) {
      console.error('addToCart failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not add item to cart.';
      return { success: false, message: msg };
    } finally {
      this.loading.set(false);
    }
  }

  /** Sets the quantity for a product (removes if qty <= 0). */
  async setQuantity(productId: string, quantity: number): Promise<void> {
    const line = this.lines().find((l) => l.product.id === productId);
    if (!line) return;

    const max = maxQty(line.product);
    const clampedQty = quantity <= 0 ? 0 : Math.min(Math.max(1, quantity), max);
    const user = this.auth.user();
    const isLoggedIn = !!user;

    this.loading.set(true);
    try {
      if (isLoggedIn) {
        if (clampedQty === 0) {
          await this.removeFromServerCart(user.id, productId);
        } else {
          await this.updateServerCartQty(user.id, productId, clampedQty);
        }
      } else {
        this.setLocalCartQty(productId, clampedQty);
      }
    } catch (err) {
      console.error('setQuantity failed:', err);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  /** Removes a product from the cart. */
  async removeFromCart(productId: string): Promise<void> {
    await this.setQuantity(productId, 0);
  }

  /** Clears the entire cart and voucher. */
  async clear(): Promise<void> {
    const user = this.auth.user();
    const isLoggedIn = !!user;

    this.loading.set(true);
    try {
      if (isLoggedIn) {
        await this.clearServerCart(user.id);
      }
      this.lines.set([]);
      this.selectedVoucher.set(null);
      this.persistLocal();
      this.persistVoucherLocal();
    } catch (err) {
      console.error('clear failed:', err);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  /** Picks the voucher to apply to this cart (null clears the selection). */
  applyVoucher(voucher: Voucher | null): void {
    if (voucher) {
      this.selectedVoucher.set({ ...voucher });
    } else {
      this.selectedVoucher.set(null);
    }
    this.persistVoucherLocal();
  }

  clearVoucher(): void {
    this.selectedVoucher.set(null);
    this.persistVoucherLocal();
  }

  // ── Internal: LocalStorage (guest) ────────────────────────────────────────

  private storageKey(): string {
    const uid = this.auth.user()?.id;
    return uid ? `knead-to-know:cart:${uid}` : CART_STORAGE_KEY;
  }

  private voucherStorageKey(): string {
    const uid = this.auth.user()?.id;
    return uid ? `knead-to-know:voucher:${uid}` : VOUCHER_STORAGE_KEY;
  }

  private loadLocal(): CartLine[] {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw) as CartLine[];
      return Array.isArray(parsed)
        ? parsed.filter((l) => l && l.product && typeof l.quantity === 'number' && l.quantity > 0)
        : [];
    } catch {
      return [];
    }
  }

  private loadVoucherLocal(): Voucher | null {
    try {
      const raw = localStorage.getItem(this.voucherStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Voucher;
      return parsed && typeof parsed === 'object' && typeof parsed.id === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  private persistLocal(): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this.lines()));
    } catch {
      // storage unavailable (private mode); cart works for the session only
    }
  }

  private persistVoucherLocal(): void {
    try {
      const v = this.selectedVoucher();
      if (v) {
        localStorage.setItem(this.voucherStorageKey(), JSON.stringify(v));
      } else {
        localStorage.removeItem(this.voucherStorageKey());
      }
    } catch {
      // storage unavailable
    }
  }

  private addToLocalCart(product: Product, quantity: number, max: number): void {
    this.lines.update((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: Math.min(max, Math.max(1, l.quantity + quantity)) }
            : l
        );
      }
      return [...prev, { product, quantity: Math.min(max, Math.max(1, quantity)) }];
    });
    this.persistLocal();
  }

  private setLocalCartQty(productId: string, quantity: number): void {
    this.lines.update((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.product.id !== productId);
      return prev.map((l) =>
        l.product.id === productId
          ? { ...l, quantity: Math.min(Math.max(1, quantity), maxQty(l.product)) }
          : l
      );
    });
    this.persistLocal();
  }

  private getLineQuantity(productId: string): number {
    return this.lines().find((l) => l.product.id === productId)?.quantity ?? 0;
  }

  // ── Internal: Supabase (logged-in users) ──────────────────────────────────

  private async loadForCurrentKey(): Promise<void> {
    const user = this.auth.user();
    if (user) {
      await this.loadFromServer(user.id);
    } else {
      this.lines.set(this.loadLocal());
      this.selectedVoucher.set(this.loadVoucherLocal());
    }
  }

  private async loadFromServer(userId: string): Promise<void> {
    try {
      const { data, error } = await this.db.client
        .from('cart_items')
        .select('*, product:products(*)')
        .eq('user_id', userId);

      if (error) throw error;

      const lines: CartLine[] = (data ?? []).map((row: any) => ({
        product: row.product as Product,
        quantity: row.quantity,
      }));
      this.lines.set(lines);
    } catch (err) {
      console.error('loadFromServer failed:', err);
      this.lines.set([]);
    }
  }

  private async addToServerCart(userId: string, productId: string, quantity: number, max: number): Promise<void> {
    const clampedQty = Math.min(max, Math.max(1, quantity));

    // Upsert: insert new or increment existing
    const { error } = await this.db.client.rpc('upsert_cart_item', {
      p_user_id: userId,
      p_product_id: productId,
      p_quantity: clampedQty,
    });

    if (error) throw error;

    // Reload to get fresh product data (price, stock, etc.)
    await this.loadFromServer(userId);
  }

  private async updateServerCartQty(userId: string, productId: string, quantity: number): Promise<void> {
    const { error } = await this.db.client
      .from('cart_items')
      .update({ quantity })
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) throw error;

    await this.loadFromServer(userId);
  }

  private async removeFromServerCart(userId: string, productId: string): Promise<void> {
    const { error } = await this.db.client
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) throw error;

    await this.loadFromServer(userId);
  }

  private async clearServerCart(userId: string): Promise<void> {
    const { error } = await this.db.client
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  /** Merges guest localStorage cart into Supabase on login, then loads server cart. */
  private async mergeGuestCartAndLoadServer(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    const guestLines = this.loadLocal();
    if (guestLines.length === 0) {
      // No guest cart to merge; just load server cart.
      await this.loadFromServer(user.id);
      return;
    }

    try {
      // Upsert each guest line into server cart
      for (const line of guestLines) {
        const max = maxQty(line.product);
        if (max === 0) continue; // skip sold out
        const qty = Math.min(line.quantity, max);
        await this.db.client.rpc('upsert_cart_item', {
          p_user_id: user.id,
          p_product_id: line.product.id,
          p_quantity: qty,
        });
      }

      // Clear guest localStorage after successful merge
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(VOUCHER_STORAGE_KEY);

      // Load the merged server cart
      await this.loadFromServer(user.id);
    } catch (err) {
      console.error('mergeGuestCartAndLoadServer failed:', err);
      // On failure, keep guest cart in localStorage and show it
      this.lines.set(guestLines);
    }
  }
}