import { Injectable, computed, signal } from '@angular/core';
import { Product } from './products.service';

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

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Persistent shopping cart. State lives in a signal so any component that
 * reads it re-renders automatically (zoneless-ready), and every change is
 * mirrored to localStorage so the basket survives page reloads.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  /** Flat list of lines (max 1 line per product). */
  readonly lines = signal<CartLine[]>(this.load());

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

  readonly tax = computed(() => this.subtotal() * TAX_RATE);

  readonly total = computed(
    () => this.subtotal() + this.deliveryFee() + this.tax()
  );

  // ── Mutations ────────────────────────────────────────────────────────────────

  add(product: Product, quantity = 1): void {
    this.lines.update((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: Math.max(1, l.quantity + quantity) }
            : l
        );
      }
      return [...prev, { product, quantity: Math.max(1, quantity) }];
    });
    this.persist();
  }

  setQuantity(productId: string, quantity: number): void {
    this.lines.update((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l))
    );
    this.persist();
  }

  remove(productId: string): void {
    this.lines.update((prev) => prev.filter((l) => l.product.id !== productId));
    this.persist();
  }

  clear(): void {
    this.lines.set([]);
    this.persist();
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  private load(): CartLine[] {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as CartLine[];
      return Array.isArray(parsed)
        ? parsed.filter((l) => l && l.product && typeof l.quantity === 'number' && l.quantity > 0)
        : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.lines()));
    } catch {
      // storage unavailable (private mode); cart works for the session only
    }
  }
}