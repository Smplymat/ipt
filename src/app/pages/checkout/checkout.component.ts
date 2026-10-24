import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { MapsService } from '../../services/maps.service';
import { FulfillmentType, OrdersService, PlaceOrderParams, toErrorMessage } from '../../services/orders.service';
import { PaymentService, PaymentMethod, CreatePaymentResponse } from '../../services/payment.service';
import {
  UserVoucherWithVoucher,
  VouchersService,
  type Voucher,
} from '../../services/vouchers.service';

import {
  ButtonComponent,
  FormFieldComponent,
  SegmentedTabsComponent,
  StepIndicatorComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PageHeaderComponent,
} from '../../shared';

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
    IonContent,
    ButtonComponent,
    FormFieldComponent,
    SegmentedTabsComponent,
    StepIndicatorComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrdersService);
  private readonly maps = inject(MapsService);
  private readonly auth = inject(AuthService);
  private readonly vouchers = inject(VouchersService);
  private readonly paymentService = inject(PaymentService);
  private readonly router = inject(Router);

  readonly form = signal<DeliveryForm>({ ...EMPTY_FORM });
  readonly touched = signal(false);
  readonly payment = signal<PaymentMethod>('cod');
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

  /** Retry loading claimed vouchers. */
  async retryLoadVouchers(): Promise<void> {
    await this.loadClaimedVouchers();
  }

  /** Applies (or clears) the voucher selected in the picker. */
  onVoucherChange(voucherId: string): void {
    const found = this.claimedVouchers().find((c) => c.voucher_id === voucherId);
    this.cart.applyVoucher(found?.voucher ?? null);
  }

  clearVoucher(): void {
    this.cart.clearVoucher();
  }

  /** Handles fulfillment type change from segmented tabs. */
  onFulfillmentChange(value: string): void {
    this.fulfillment.set(value as FulfillmentType);
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

  /** Safely get error message for a field (returns empty string if no error). */
  getError(field: keyof FormErrors): string {
    return this.errors()[field] ?? '';
  }

  /** Handles schedule mode change from segmented tabs. */
  onScheduleChange(value: string): void {
    this.scheduleMode.set(value as 'asap' | 'scheduled');
  }

  /** Handles payment method change from segmented tabs. */
  onPaymentChange(value: string): void {
    this.payment.set(value as PaymentMethod);
  }

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

  async cartQty(productId: string, delta: number): Promise<void> {
    const current = this.lines().find((l) => l.product.id === productId)?.quantity ?? 0;
    try {
      await this.cart.setQuantity(productId, current + delta);
    } catch (err) {
      console.error('cartQty failed:', err);
    }
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

      // Resolve scheduled_at
      const scheduledAt =
        this.scheduleMode() === 'scheduled' && this.scheduledAt()
          ? new Date(this.scheduledAt()).toISOString()
          : null;

      const isPickup = this.fulfillment() === 'pickup';
      const voucher = this.selectedVoucher();
      const selectedPayment = this.payment();

      // Build params for the order
      const params: PlaceOrderParams = {
        customer_name: f.name.trim(),
        phone: f.phone.trim(),
        fulfillment_type: this.fulfillment(),
        address: isPickup ? '' : f.address.trim(),
        unit_notes: isPickup ? '' : f.unit.trim(),
        latitude: isPickup ? null : f.lat,
        longitude: isPickup ? null : f.lng,
        scheduled_at: scheduledAt,
        payment_method: selectedPayment,
        promo_code: voucher ? voucher.code : null,
      };

      const order = await this.orders.placeOrder(params, this.cart.lines());

      // The function has already marked the voucher redeemed inside the same
      // transaction, so the wallet is immediately consistent.

      // For COD, we're done - order created with unpaid status
      if (selectedPayment === 'cod') {
        this.cart.clear();
        await this.router.navigate(['/order-confirmation', order.id]);
        return;
      }

      // For online payments, create PayMongo checkout session
      const paymentResult: CreatePaymentResponse = await this.paymentService.createPayment(order.id, selectedPayment);

      if (!paymentResult.success) {
        this.orderError.set(paymentResult.error || 'Failed to initialize payment');
        return;
      }

      if (paymentResult.checkout_url) {
        // Open PayMongo checkout (in-app browser tab on mobile, redirect on web)
        await this.paymentService.openCheckout(paymentResult.checkout_url);
        return;
      }

      // Fallback: if no checkout URL, go to confirmation
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

  // ── Step indicator data ────────────────────────────────────────────────────
  readonly steps = [
    { label: 'Your Bag', description: 'Review items' },
    { label: 'Fulfillment', description: 'Delivery or pickup' },
    { label: 'Details', description: 'Address & schedule' },
    { label: 'Payment', description: 'Choose payment method' },
  ];

  readonly currentStep = computed(() => {
    if (this.fulfillment() === 'pickup' && this.scheduleMode() === 'asap' && this.payment() === 'cod') {
      return 3; // Skip to payment if simple order
    }
    return 2; // Default to step 2 (fulfillment) as starting point
  });

  // ── Fulfillment segments ───────────────────────────────────────────────────
  readonly fulfillmentSegments = [
    { value: 'delivery', label: 'Delivery', icon: 'bicycle-outline', 
      desc: this.subtotal() >= 500 ? 'Free delivery on this order!' : `+${this.formatPrice(this.deliveryFee())} delivery fee` },
    { value: 'pickup', label: 'In-Store Pickup', icon: 'storefront-outline', 
      desc: 'Pick up at 123 Banawe St, Quezon City. No delivery fee.' },
  ];

  // ── Schedule segments ──────────────────────────────────────────────────────
  readonly scheduleSegments = [
    { value: 'asap', label: 'As Soon As Possible', icon: 'flash-outline', desc: "We'll get on it right away." },
    { value: 'scheduled', label: 'Schedule for Later', icon: 'calendar-outline', desc: 'Pick a date and time at least 30 minutes from now.' },
  ];

  // ── Payment segments ───────────────────────────────────────────────────────
  readonly paymentSegments = [
    { value: 'cod', label: 'Cash on Delivery', icon: 'cash-outline', desc: this.fulfillment() === 'pickup' ? 'Pay at the counter when you pick up.' : 'Pay the driver when your order arrives.' },
    { value: 'card', label: 'Credit / Debit Card', icon: 'card-outline', desc: 'Visa, Mastercard, JCB via PayMongo' },
    { value: 'gcash', label: 'GCash', icon: 'logo-gcash', desc: 'Pay with your GCash wallet' },
    { value: 'paymaya', label: 'Maya', icon: 'logo-paymaya', desc: 'Pay with your Maya account' },
    { value: 'grab_pay', label: 'GrabPay', icon: 'logo-grabpay', desc: 'Pay with your Grab wallet' },
  ];

  // ── Voucher picker segments ────────────────────────────────────────────────
  readonly voucherSegments = computed(() => 
    this.claimedVouchers().map(c => ({
      value: c.voucher_id,
      label: c.voucher?.code ?? '',
      icon: 'pricetag-outline',
      desc: this.voucherLabel(c),
    }))
  );
}