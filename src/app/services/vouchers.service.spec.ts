import {
  voucherDiscountAmount,
  voucherEligibleSubtotal,
  voucherIssue,
  type Voucher,
} from './vouchers.service';
import type { CartLine } from './cart.service';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeVoucher(patch: Partial<Voucher> = {}): Voucher {
  return {
    id: 'v1',
    code: 'TEST10',
    title: 'Test voucher',
    description: '',
    discount_type: 'percent',
    discount_value: 10,
    minimum_spend: 0,
    max_discount: null,
    eligible_categories: [],
    starts_at: '2026-01-01T00:00:00.000Z',
    expires_at: null,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

function line(category: string, price: number, quantity = 1): CartLine {
  return {
    product: {
      id: Math.random().toString(36).slice(2),
      name: category,
      category,
      description: '',
      price,
      rating: 0,
      stock_quantity: 10,
      image_url: '',
      ingredients: '',
      nutritional_value: '',
      extra_info: [],
      created_at: '',
    },
    quantity,
  };
}

// ─── voucherEligibleSubtotal ──────────────────────────────────────────────────

describe('voucherEligibleSubtotal', () => {
  it('uses the full cart subtotal when no category filter is set', () => {
    const v = makeVoucher();
    const lines = [line('Pastries', 100, 2), line('Cakes', 250)];
    expect(voucherEligibleSubtotal(v, lines)).toBe(450);
  });

  it('filters the cart to the voucher categories', () => {
    const v = makeVoucher({ eligible_categories: ['Cakes'] });
    const lines = [line('Pastries', 100, 2), line('Cakes', 250)];
    expect(voucherEligibleSubtotal(v, lines)).toBe(250);
  });

  it('returns 0 when no line matches the categories', () => {
    const v = makeVoucher({ eligible_categories: ['Cakes'] });
    const lines = [line('Pastries', 100)];
    expect(voucherEligibleSubtotal(v, lines)).toBe(0);
  });
});

// ─── voucherIssue ─────────────────────────────────────────────────────────────

describe('voucherIssue', () => {
  it('returns null when the voucher is usable', () => {
    const v = makeVoucher({ eligible_categories: ['Pastries'] });
    expect(voucherIssue(v, [line('Pastries', 100)])).toBeNull();
  });

  it('returns null when no voucher is selected', () => {
    expect(voucherIssue(null, [line('Pastries', 100)])).toBeNull();
  });

  it('flags an expired voucher', () => {
    const v = makeVoucher({ expires_at: '2026-01-15T00:00:00.000Z' });
    const now = new Date('2026-03-01T00:00:00.000Z').getTime();
    expect(voucherIssue(v, [line('Pastries', 100)], now)).toContain('expired');
  });

  it('reports when the minimum spend is not met', () => {
    const v = makeVoucher({ minimum_spend: 300 });
    expect(voucherIssue(v, [line('Pastries', 100)])).toContain('300.00');
  });

  it('reports when nothing in the cart matches the category filter', () => {
    const v = makeVoucher({ eligible_categories: ['Cakes', 'Pastries'] });
    const issue = voucherIssue(v, [line('Bread', 100)]);
    expect(issue).toContain('Cakes or Pastries');
  });

  it('reports an empty cart without a category filter', () => {
    expect(voucherIssue(makeVoucher(), [])).toContain('Nothing in your cart');
  });
});

// ─── voucherDiscountAmount ────────────────────────────────────────────────────

describe('voucherDiscountAmount', () => {
  it('applies a percentage to the eligible subtotal', () => {
    const v = makeVoucher({ discount_value: 10 });
    expect(voucherDiscountAmount(v, [line('Pastries', 100, 2), line('Cakes', 250)])).toBe(45);
  });

  it('caps a percentage at max_discount', () => {
    const v = makeVoucher({ discount_value: 50, max_discount: 40 });
    expect(voucherDiscountAmount(v, [line('Pastries', 100)])).toBe(40);
  });

  it('applies a fixed amount', () => {
    const v = makeVoucher({ discount_type: 'fixed', discount_value: 50 });
    expect(voucherDiscountAmount(v, [line('Pastries', 100, 2)])).toBe(50);
  });

  it('never discounts more than the eligible subtotal', () => {
    const v = makeVoucher({ discount_type: 'fixed', discount_value: 200 });
    expect(voucherDiscountAmount(v, [line('Pastries', 150)])).toBe(150);
  });

  it('only discounts lines in the eligible categories', () => {
    const v = makeVoucher({ discount_value: 10, eligible_categories: ['Cakes'] });
    const lines = [line('Pastries', 100, 2), line('Cakes', 250)];
    expect(voucherDiscountAmount(v, lines)).toBe(25);
  });

  it('returns 0 when the minimum spend is not met', () => {
    const v = makeVoucher({ minimum_spend: 300 });
    expect(voucherDiscountAmount(v, [line('Pastries', 100)])).toBe(0);
  });

  it('returns 0 when nothing is eligible', () => {
    const v = makeVoucher({ eligible_categories: ['Cakes'] });
    expect(voucherDiscountAmount(v, [line('Pastries', 100)])).toBe(0);
  });
});