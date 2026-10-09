import { TestBed } from '@angular/core/testing';
import {
  OrdersService,
  type PlaceOrderParams,
} from './orders.service';
import { DatabaseService } from './database.service';
import { CartService, type CartLine } from './cart.service';
import { AuthService } from './auth.service';
import type { Product } from './products.service';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeProduct(patch: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Classic Sourdough',
    category: 'Bread',
    description: '',
    price: 180,
    rating: 4.8,
    stock_quantity: 25,
    image_url: '',
    ingredients: [],
    nutritional_value: '',
    extra_info: [],
    created_at: '2026-01-01T00:00:00.000Z',
    ...patch,
  } as Product;
}

function makeLine(product: Product, quantity = 1): CartLine {
  return { product, quantity };
}

function makeParams(patch: Partial<PlaceOrderParams> = {}): PlaceOrderParams {
  return {
    customer_name: 'Ralph',
    phone: '09171234567',
    fulfillment_type: 'delivery',
    address: '123 Baker St',
    unit_notes: 'Gate 2',
    latitude: 14.6,
    longitude: 121.0,
    scheduled_at: null,
    payment_method: 'cod',
    promo_code: null,
    ...patch,
  };
}

// ─── RPC client stub ──────────────────────────────────────────────────────────

type RpcCall = { fn: string; args: Record<string, unknown> };

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

interface StubClient {
  rpc: (fn: string, args: Record<string, unknown>) => RpcResult;
}

interface Stub {
  client: StubClient;
  calls: RpcCall[];
  dbService: DatabaseService;
}

function stubRpc(result: RpcResult): Stub {
  const calls: RpcCall[] = [];
  const client: StubClient = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return result;
    },
  };
  const dbService = { client } as unknown as DatabaseService;
  return { client, calls, dbService };
}

function buildOrders(rpc: RpcResult) {
  const { client, calls, dbService } = stubRpc(rpc);
  TestBed.configureTestingModule({
    providers: [{ provide: DatabaseService, useValue: dbService }],
  });
  return { svc: TestBed.inject(OrdersService), calls };
}

// ─── placeOrder → place_order RPC ─────────────────────────────────────────────

describe('OrdersService.placeOrder', () => {
  it('calls the place_order RPC function and returns the created order', async () => {
    const { svc, calls } = buildOrders({ data: { id: 'o1' }, error: null });
    const order = await svc.placeOrder(makeParams(), [makeLine(makeProduct())]);
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('place_order');
    expect(order.id).toBe('o1');
  });

  it('sends only product_id + quantity per line — never prices or totals', async () => {
    const { svc, calls } = buildOrders({ data: { id: 'o1' }, error: null });
    const p = makeProduct({ price: 999, stock_quantity: 3 });
    await svc.placeOrder(
      makeParams(),
      [makeLine(p, 2), makeLine(makeProduct({ id: 'prod-2' }), 1)]
    );
    const args = calls[0].args as Record<string, unknown>;
    expect(args['p_cart']).toEqual([
      { product_id: 'prod-1', qty: 2 },
      { product_id: 'prod-2', qty: 1 },
    ]);
    const serialized = JSON.stringify(args);
    // Server-side pricing: the client must not send money/stock fields.
    expect(serialized).not.toContain('p_subtotal');
    expect(serialized).not.toContain('p_total');
    expect(serialized).not.toContain('price');
    expect(serialized).not.toContain('stock');
  });

  it('forwards fulfillment/contact fields, scheduled time and promo code', async () => {
    const { svc, calls } = buildOrders({ data: { id: 'o1' }, error: null });
    await svc.placeOrder(
      makeParams({ promo_code: 'BAKE10', scheduled_at: '2026-02-01T09:00:00.000Z' }),
      [makeLine(makeProduct())]
    );
    const args = calls[0].args as Record<string, unknown>;
    expect(args['p_customer_name']).toBe('Ralph');
    expect(args['p_phone']).toBe('09171234567');
    expect(args['p_fulfillment_type']).toBe('delivery');
    expect(args['p_address']).toBe('123 Baker St');
    expect(args['p_payment_method']).toBe('cod');
    expect(args['p_promo_code']).toBe('BAKE10');
    expect(args['p_scheduled_at']).toBe('2026-02-01T09:00:00.000Z');
  });

  it('throws with the server-side message when the RPC rejects', async () => {
    const { svc } = buildOrders({
      data: null,
      error: { message: 'Not enough stock for Classic Sourdough.' },
    });
    await expect(
      svc.placeOrder(makeParams(), [makeLine(makeProduct())]).then(
        () => Promise.resolve(),
        (err: unknown) => Promise.reject(err)
      )
    ).rejects.toThrowError('Not enough stock for Classic Sourdough.');
  });
});

// ─── Cart stock capping (mirrors the clamp enforced by place_order) ──────────

describe('CartService stock capping', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { user: () => null } }],
    });
    const cart = TestBed.inject(CartService);
    cart.clear();
  });

  it('caps an added quantity at the product stock', async () => {
    const cart = TestBed.inject(CartService);
    await cart.addToCart(makeProduct({ id: 'p', stock_quantity: 3 }), 10);
    expect(cart.lines()[0].quantity).toBe(3);
  });

  it('ignores a sold-out product', async () => {
    const cart = TestBed.inject(CartService);
    const result = await cart.addToCart(makeProduct({ id: 'p', stock_quantity: 0 }), 2);
    expect(result.success).toBe(false);
    expect(cart.lines().length).toBe(0);
  });

  it('clamps a raised quantity to the remaining stock', async () => {
    const cart = TestBed.inject(CartService);
    await cart.addToCart(makeProduct({ id: 'p', stock_quantity: 5 }), 1);
    await cart.setQuantity('p', 99);
    expect(cart.lines()[0].quantity).toBe(5);
  });
});
