import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { MapsService } from '../../services/maps.service';
import { FulfillmentType, OrdersService, PlaceOrderParams, toErrorMessage } from '../../services/orders.service';
import {
  UserVoucherWithVoucher,
  VouchersService,
  type Voucher,
} from '../../services/vouchers.service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeliveryForm {
  name: string;
  phone: string;
  address: string;
  unit: string;
  lat: number | null;
  lng: number | null;
}

type FormErrorKey = 'name' | 'phone' | 'address' | 'coords';
type FormErrors = Partial<Record<FormErrorKey, string>>;

const EMPTY_FORM: DeliveryForm = { name: '', phone: '', address: '', unit: '', lat: null, lng: null };

// Minimum number of minutes ahead a scheduled order must be placed.
const MIN_SCHEDULE_MINUTES = 30;

@Component({
  selector: 'app-checkout',
  imports: [
    DatePipe,
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrdersService);
  private readonly maps = inject(MapsService);
  private readonly auth = inject(AuthService);
  private readonly vouchers = inject(VouchersService);
  private readonly router = inject(Router);

  readonly form = signal<DeliveryForm>({ ...EMPTY_FORM });
  readonly touched = signal(false);
  readonly payment = signal<'cod' | 'online'>('cod');
  readonly placing = signal(false);
  readonly orderError = signal<string | null>(null);

  // ── Fulfillment type ──────────────────────────────────────────────────────
  readonly fulfillment = signal<FulfillmentType>('delivery');

  // ── Order schedule ────────────────────────────────────────────────────────
  /** 'asap' = place immediately; 'scheduled' = pick a date/time */
  readonly scheduleMode = signal<'asap' | 'scheduled'>('asap');
  readonly scheduledAt = signal<string>(''); // ISO datetime-local string

  /** Minimum datetime value for the scheduler input (now + MIN_SCHEDULE_MINUTES). */
  readonly minScheduleDateTime = computed(() => {
    const d = new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
    // datetime-local input wants "YYYY-MM-DDTHH:mm" in LOCAL time.
    // toISOString() returns UTC, which is ~8 h too early in PH (UTC+8).
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      d.getFullYear() +
      '-' + pad(d.getMonth() + 1) +
      '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) +
      ':' + pad(d.getMinutes())
    );
  });

  /** Google Maps availability. */
  readonly mapConfigured = this.maps.configured;
  readonly mapReady = signal(false);
  readonly mapError = signal(false);

  // Basket → cart service (single source of truth)
  readonly lines = this.cart.lines;
  readonly subtotal = this.cart.subtotal;
  readonly deliveryFee = this.cart.deliveryFee;
  readonly tax = this.cart.tax;
  readonly total = this.cart.total;
  readonly itemCount = this.cart.itemCount;

  // ── Voucher / discount ───────────────────────────────────────────────
  readonly selectedVoucher = this.cart.selectedVoucher;
  readonly discount = this.cart.discount;
  readonly taxable = this.cart.taxable;
  readonly voucherNote = this.cart.voucherNote;

  /** The user's claimed (not yet redeemed) vouchers to pick from. */
  readonly claimedVouchers = signal<UserVoucherWithVoucher[]>([]);
  readonly vouchersLoading = signal(false);
  readonly vouchersError = signal<string | null>(null);

  /** Short label for a claimed voucher inside the voucher picker. */
  voucherLabel(c: UserVoucherWithVoucher): string {
    const v = c.voucher;
    const off = v.discount_type === 'percent' ? `${v.discount_value}% off` : `₱${v.discount_value.toFixed(2)} off`;
    const scope = v.eligible_categories?.length ? v.eligible_categories.join(' or ') : 'any order';
    return `${v.code} · ${off} on ${scope}`;
  }

  // ── Promo code entry ────────────────────────────────────────────────────
  readonly promoCode = signal('');
  readonly promoApplying = signal(false);
  readonly promoMessage = signal<{ ok: boolean; text: string } | null>(null);

  /** Looks up a code via findCode and applies it to the cart. */
  async applyPromoCode(): Promise<void> {
    const code = this.promoCode().trim();
    if (!code) {
      return this.promoMessage.set({ ok: false, text: 'Enter a promo code first.' });
    }
    this.promoApplying.set(true);
    this.promoMessage.set(null);
    try {
      const voucher = await this.vouchers.findByCode(code);
      if (!voucher) {
        return this.promoMessage.set({ ok: false, text: `"${code}" is not a valid promo code right now.` });
      }
      this.cart.applyVoucher(voucher);
      this.promoCode.set('');
      const note = this.cart.voucherNote();
      this.promoMessage.set(
        note
          ? { ok: false, text: `Code applied but can't be used yet: ${note}.` }
          : { ok: true, text: `${voucher.code} applied — enjoy your discount!` }
      );
    } catch (err) {
      this.promoMessage.set({ ok: false, text: toErrorMessage(err) });
    } finally {
      this.promoApplying.set(false);
    }
  }

  clearPromoMessages(): void {
    this.promoMessage.set(null);
  }

  private async loadClaimedVouchers(): Promise<void> {
    this.vouchersLoading.set(true);
    this.vouchersError.set(null);
    try {
      const all = await this.vouchers.myClaimed();
      this.claimedVouchers.set(
        all.filter((c) => c.status === 'claimed' && c.voucher)
      );
    } catch (err) {
      this.vouchersError.set(toErrorMessage(err));
    } finally {
      this.vouchersLoading.set(false);
    }
  }

  /** Applies (or clears) the voucher selected in the picker. */
  onVoucherChange(voucherId: string): void {
    const found = this.claimedVouchers().find((c) => c.voucher_id === voucherId);
    this.cart.applyVoucher(found?.voucher ?? null);
  }

  clearVoucher(): void {
    this.cart.clearVoucher();
  }

  readonly errors = computed<FormErrors>(() => {
    const f = this.form();
    const errs: FormErrors = {};
    if (f.name.trim().length < 2) errs.name = 'Recipient name is required.';
    if (!/^(?:63|0)?9\d{9}$/.test(f.phone.replace(/\D/g, '')))
      errs.phone = 'Enter a valid mobile number (e.g. 09171234567).';

    // Address and coords only required for delivery orders
    if (this.fulfillment() === 'delivery') {
      if (f.address.trim().length < 5) errs.address = 'Delivery address is required.';
      if (f.lat == null || f.lng == null) errs.coords = 'Set the delivery pin or coordinates.';
    }

    return errs;
  });

  readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  // ── Schedule validation ───────────────────────────────────────────────────
  readonly scheduleError = computed(() => {
    if (this.scheduleMode() !== 'scheduled') return null;
    const val = this.scheduledAt();
    if (!val) return 'Please select a date and time.';
    const selected = new Date(val).getTime();
    const earliest = Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000;
    if (selected < earliest) return `Schedule must be at least ${MIN_SCHEDULE_MINUTES} minutes from now.`;
    return null;
  });

  constructor() {
    // Prefill the recipient with the account display name.
    const name = this.auth.user()?.displayName;
    if (typeof name === 'string' && name.trim().length >= 2) {
      this.form.update((f) => ({ ...f, name: name.trim() }));
    }

    // Kick off map + autocomplete once the DOM (and the map div) exist.
    if (this.mapConfigured) {
      afterNextRender(() => this.initMapTools());
    }

    // Load the user's claimed vouchers so they can apply a discount.
    void this.loadClaimedVouchers();
  }

  // ── Bag quantity helper ─────────────────────────────────────────────────────

  cartQty(productId: string, delta: number): void {
    const current = this.lines().find((l) => l.product.id === productId)?.quantity ?? 0;
    this.cart.setQuantity(productId, current + delta);
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────

  setField(key: keyof DeliveryForm, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  setCoord(key: 'lat' | 'lng', value: string): void {
    const n = parseFloat(value);
    this.form.update((f) => ({ ...f, [key]: Number.isFinite(n) ? n : null }));
  }

  setPin(point: { lat: number; lng: number }): void {
    this.form.update((f) => ({
      ...f,
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
    }));
  }

  // ── Google Maps ──────────────────────────────────────────────────────────────

  private async initMapTools(): Promise<void> {
    const addressInput = document.getElementById('checkout-address') as HTMLInputElement | null;
    if (addressInput) {
      void this.maps
        .createAutocomplete(addressInput, (point, formatted) => {
          this.form.update((f) => ({
            ...f,
            address: formatted,
            lat: Number(point.lat.toFixed(6)),
            lng: Number(point.lng.toFixed(6)),
          }));
        })
        .catch(() => undefined);
    }

    const mapEl = document.getElementById('checkout-map');
    if (mapEl) {
      try {
        await this.maps.createMap(mapEl, this.maps.defaultCenter(), (p) => this.setPin(p));
        this.mapReady.set(true);
      } catch {
        this.mapError.set(true);
      }
    }
  }

  // ── Place order ──────────────────────────────────────────────────────────────

  async placeOrder(): Promise<void> {
    this.touched.set(true);
    if (this.hasErrors()) return;
    if (this.scheduleError()) return;
    if (this.placing()) return;

    // A selected voucher must actually apply — surface the reason otherwise.
    if (this.selectedVoucher() && this.voucherNote()) {
      this.orderError.set(
        `The selected voucher cannot be used: ${this.voucherNote()}. Remove it or adjust your order.`
      );
      return;
    }

    this.placing.set(true);
    this.orderError.set(null);
    try {
      const f = this.form();

      // Online payment: simulated gateway round trip (swap in a real SDK here).
      // The server derives payment_status from payment_method (online → paid).
      if (this.payment() === 'online') {
        await this.delay(1200);
      }

      // Resolve scheduled_at
      const scheduledAt =
        this.scheduleMode() === 'scheduled' && this.scheduledAt()
          ? new Date(this.scheduledAt()).toISOString()
          : null;

      const isPickup = this.fulfillment() === 'pickup';
      const voucher = this.selectedVoucher();

      // Only the cart line ids/quantities + contact/schedule info go to the
      // server. Prices, stock, totals, tax, discount and voucher redemption
      // are computed by the SECURITY DEFINER `place_order` function (see 0008).
      // The numbers shown in the summary above are a client-side preview only.
      const params: PlaceOrderParams = {
        customer_name: f.name.trim(),
        phone: f.phone.trim(),
        fulfillment_type: this.fulfillment(),
        address: isPickup ? '' : f.address.trim(),
        unit_notes: isPickup ? '' : f.unit.trim(),
        latitude: isPickup ? null : f.lat,
        longitude: isPickup ? null : f.lng,
        scheduled_at: scheduledAt,
        payment_method: this.payment(),
        promo_code: voucher ? voucher.code : null,
      };

      const order = await this.orders.placeOrder(params, this.cart.lines());

      // The function has already marked the voucher redeemed inside the same
      // transaction, so the wallet is immediately consistent.

      this.cart.clear();
      await this.router.navigate(['/order-confirmation', order.id]);
    } catch (err) {
      this.orderError.set(toErrorMessage(err));
    } finally {
      this.placing.set(false);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  /** Total shown in the summary — adjusts for pickup (no delivery fee). */
  displayTotal = computed(() =>
    this.fulfillment() === 'pickup'
      ? this.taxable() + this.tax()
      : this.total()
  );

  /** Display-friendly delivery fee — FREE for pickup. */
  displayDeliveryFee = computed(() =>
    this.fulfillment() === 'pickup' ? 0 : this.deliveryFee()
  );
}