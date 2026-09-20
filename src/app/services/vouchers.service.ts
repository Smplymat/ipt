import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import type { CartLine } from './cart.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DiscountType = 'percent' | 'fixed';
export type VoucherStatus = 'claimed' | 'redeemed' | 'expired';

export interface Voucher {
  id: string;
  code: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_spend: number;
  max_discount: number | null;
  /** Empty array (or unset) = valid on the whole cart. */
  eligible_categories: string[];
  starts_at: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface UserVoucher {
  id: string;
  user_id: string;
  voucher_id: string;
  status: VoucherStatus;
  claimed_at: string;
  redeemed_at: string | null;
  used_order_id: string | null;
}

export interface UserVoucherWithVoucher extends UserVoucher {
  voucher: Voucher;
}

// ─── Discount model ──────────────────────────────────────────────────────────
//
// Shared with the checkout preview and 0006/0008 (_vouchers / _order_integrity
// migrations): the client uses these rules for its live summary, and the
// SECURITY DEFINER `place_order` function re-derives the final numbers
// server-side inside one transaction (validating the voucher: active window,
// min spend, category eligibility, cap, not already redeemed) and marks the
// wallet row redeemed against the new order id:
//
//   eligibleSubtotal  = full cart subtotal, or the subtotal of the voucher's
//                       eligible_categories when that filter is set.
//   discount          = eligibleSubtotal * discount_value/100   (percent, capped
//                       at max_discount)  or  discount_value    (fixed, capped
//                       at eligibleSubtotal).
//   minimum_spend     = required eligibleSubtotal to apply.
//   taxable           = subtotal - discount   (tax is charged after discount).
//
// PostgREST endpoints used by this service (REST, anon JWT):
//   GET  /rest/v1/vouchers?select=*&active=eq.true&or=(expires_at.is.null,expires_at.gt.NOW)
//   GET  /rest/v1/user_vouchers?select=*,voucher:vouchers(*)
//   POST /rest/v1/user_vouchers  body={ voucher_id }   (user_id forced by RLS)
//   (redemption is no longer done by PATCH here — place_order() handles it)

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Portion of the cart (in ₱) that a voucher can actually discount. */
export function voucherEligibleSubtotal(v: Voucher, lines: CartLine[]): number {
  const cats = v.eligible_categories;
  if (!cats || cats.length === 0) {
    return round2(lines.reduce((s, l) => s + l.product.price * l.quantity, 0));
  }
  return round2(
    lines
      .filter((l) => cats.includes(l.product.category))
      .reduce((s, l) => s + l.product.price * l.quantity, 0)
  );
}

/** Human-readable eligibility problem, or null when the voucher is usable. */
export function voucherIssue(
  v: Voucher | null,
  lines: CartLine[],
  now = Date.now()
): string | null {
  if (!v) return null;
  if (v.expires_at && new Date(v.expires_at).getTime() <= now) {
    return 'This voucher has expired.';
  }
  const eligible = voucherEligibleSubtotal(v, lines);
  if (eligible <= 0) {
    return v.eligible_categories?.length
      ? `Add ${v.eligible_categories.join(' or ')} items to use this voucher.`
      : 'Nothing in your cart can be discounted yet.';
  }
  if (eligible < v.minimum_spend) {
    return `Spend ₱${v.minimum_spend.toFixed(2)} or more to apply this voucher.`;
  }
  return null;
}

/** The ₱ discount a voucher applies to the given cart (0 when ineligible). */
export function voucherDiscountAmount(v: Voucher, lines: CartLine[]): number {
  const eligible = voucherEligibleSubtotal(v, lines);
  if (eligible <= 0 || eligible < v.minimum_spend) return 0;
  const raw =
    v.discount_type === 'percent' ? (eligible * v.discount_value) / 100 : v.discount_value;
  const capped = v.max_discount != null ? Math.min(raw, v.max_discount) : raw;
  return round2(Math.max(0, Math.min(capped, eligible)));
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class VouchersService {
  private readonly db = inject(DatabaseService);

  private get client() {
    return this.db.client;
  }

  private mapVoucher(row: Record<string, unknown>): Voucher {
    return {
      ...(row as Record<string, unknown>),
      discount_value: Number(row['discount_value']),
      minimum_spend: Number(row['minimum_spend']),
      max_discount: row['max_discount'] == null ? null : Number(row['max_discount']),
      eligible_categories: Array.isArray(row['eligible_categories'])
        ? (row['eligible_categories'] as string[])
        : [],
    } as Voucher;
  }

  /** Active, currently valid offers shown on the Promotions page. */
  async listAvailable(): Promise<Voucher[]> {
    const { data, error } = await this.client
      .from('vouchers')
      .select('*')
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => this.mapVoucher(r));
  }

  /**
   * Looks up a currently active offer by its promo code (case-insensitive).
   * Used by the checkout "enter promo code" box. Returns null when unknown,
   * inactive, or expired.
   */
  async findByCode(code: string): Promise<Voucher | null> {
    const { data, error } = await this.client
      .from('vouchers')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapVoucher(data as Record<string, unknown>) : null;
  }

  /** The signed-in user's wallet: their claimed vouchers, newest first. */
  async myClaimed(): Promise<UserVoucherWithVoucher[]> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) return [];
    const { data, error } = await this.client
      .from('user_vouchers')
      .select('*, voucher:vouchers(*)')
      .order('claimed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...(row as unknown as UserVoucher),
      voucher: this.mapVoucher((row['voucher'] as Record<string, unknown>) ?? {}),
    }));
  }

  /**
   * Adds a voucher to the caller's wallet. Duplicate claims are rejected by
   * the unique(user_id, voucher_id) constraint and surfaced as a friendly error.
   */
  async claim(voucherId: string): Promise<void> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) throw new Error('You must be signed in to claim a voucher.');
    const { error } = await this.client
      .from('user_vouchers')
      .insert({ user_id: user.id, voucher_id: voucherId });
    if (error) {
      if (error.code === '23505') throw new Error('You have already claimed this voucher.');
      throw new Error(error.message);
    }
  }
}