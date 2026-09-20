import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Product } from './products.service';
import { AuthService } from './auth.service';
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

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Persistent shopping cart. State lives in a signal so any component that
 * reads it re-renders automatically (zoneless-ready), and every change is
 * mirrored to localStorage so the basket survives page reloads.
 *
 * The storage key is scoped to the signed-in user's ID so that carts on
 * shared devices do not bleed across accounts.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly auth = inject(AuthService);

  /** Returns the localStorage key for the current user, or a guest key. */
  private storageKey(): string {
    const uid = this.auth.user()?.id;
    return uid ? `knead-to-know:cart:${uid}` : CART_STORAGE_KEY;
  }

  /** Voucher storage key, scoped to the user the same way the cart is. */
  private voucherStorageKey(): string {
    const uid = this.auth.user()?.id;
    return uid ? `knead-to-know:voucher:${uid}` : VOUCHER_STORAGE_KEY;
  }
  /** Flat list of lines (max 1 line per product). */
  readonly lines = signal<CartLine[]>([]);

  /** Storage key in effect the last time the cart was (re)loaded. */
  private activeKey = '';

  /** The voucher the user picked for this cart (kept in sync with the cart). */
  readonly selectedVoucher = signal<Voucher | null>(null);

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
    // Load the persisted cart for whatever identity is current. The auth
    // session may still be resolving at this point (its INITIAL_SESSION
    // event fires asynchronously), so this first read can hit the guest key.
    this.activeKey = this.storageKey();
    this.lines.set(this.load());
    this.selectedVoucher.set(this.loadVoucher());

    // Once the session resolves — or the user signs in/out and the current
    // ID changes — re-read the cart under the correct key so a signed-in
    // user's items are never loaded/mixed under the guest key.
    effect(() => {
      const key = this.storageKey();
      if (key !== this.activeKey) {
        this.activeKey = key;
        this.lines.set(this.load());
        this.selectedVoucher.set(this.loadVoucher());
      }
    });
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  add(product: Product, quantity = 1): void {
    const max = Math.max(0, Number(product.stock_quantity) || 0);
    if (max === 0) return; // sold out
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
    this.persist();
  }

  setQuantity(productId: string, quantity: number): void {
    this.lines.update((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.product.id !== productId);
      return prev.map((l) =>
        l.product.id === productId
          ? { ...l, quantity: Math.min(Math.max(1, quantity), maxQty(l.product)) }
          : l
      );
    });
    this.persist();
  }

  remove(productId: string): void {
    this.lines.update((prev) => prev.filter((l) => l.product.id !== productId));
    this.persist();
  }

  clear(): void {
    this.lines.set([]);
    this.selectedVoucher.set(null);
    this.persist();
    this.persistVoucher();
  }

  /** Picks the voucher to apply to this cart (null clears the selection). */
  applyVoucher(voucher: Voucher | null): void {
    if (voucher) {
      this.selectedVoucher.set({ ...voucher });
    } else {
      this.selectedVoucher.set(null);
    }
    this.persistVoucher();
  }

  clearVoucher(): void {
    this.selectedVoucher.set(null);
    this.persistVoucher();
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  private load(): CartLine[] {
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

  private loadVoucher(): Voucher | null {
    try {
      const raw = localStorage.getItem(this.voucherStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Voucher;
      return parsed && typeof parsed === 'object' && typeof parsed.id === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this.lines()));
    } catch {
      // storage unavailable (private mode); cart works for the session only
    }
  }

  private persistVoucher(): void {
    try {
      const v = this.selectedVoucher();
      if (v) {
        localStorage.setItem(this.voucherStorageKey(), JSON.stringify(v));
      } else {
        localStorage.removeItem(this.voucherStorageKey());
      }
    } catch {
      // storage unavailable (private mode); voucher works for the session only
    }
  }
}