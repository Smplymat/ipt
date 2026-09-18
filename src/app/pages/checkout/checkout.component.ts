import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { MapsService } from '../../services/maps.service';
import { NewOrderPayload, OrdersService, toErrorMessage } from '../../services/orders.service';

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

@Component({
  selector: 'app-checkout',
  imports: [
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonMenuButton,
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
  private readonly router = inject(Router);

  readonly form = signal<DeliveryForm>({ ...EMPTY_FORM });
  readonly touched = signal(false);
  readonly payment = signal<'cod' | 'online'>('cod');
  readonly placing = signal(false);
  readonly orderError = signal<string | null>(null);

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

  readonly errors = computed<FormErrors>(() => {
    const f = this.form();
    const errs: FormErrors = {};
    if (f.name.trim().length < 2) errs.name = 'Recipient name is required.';
    if (!/^(?:63|0)?9\d{9}$/.test(f.phone.replace(/\D/g, '')))
      errs.phone = 'Enter a valid mobile number (e.g. 09171234567).';
    if (f.address.trim().length < 5) errs.address = 'Delivery address is required.';
    if (f.lat == null || f.lng == null) errs.coords = 'Set the delivery pin or coordinates.';
    return errs;
  });

  readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

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
    if (this.placing()) return;

    this.placing.set(true);
    this.orderError.set(null);
    try {
      const f = this.form();

      // Online payment: simulated gateway round trip (swap in a real SDK here).
      let paymentStatus: 'pending' | 'paid' = 'pending';
      if (this.payment() === 'online') {
        await this.delay(1200);
        paymentStatus = 'paid';
      }

      const payload: NewOrderPayload = {
        customer_name: f.name.trim(),
        phone: f.phone.trim(),
        address: f.address.trim(),
        unit_notes: f.unit.trim(),
        latitude: f.lat,
        longitude: f.lng,
        payment_method: this.payment(),
        payment_status: paymentStatus,
        subtotal: this.subtotal(),
        delivery_fee: this.deliveryFee(),
        tax: this.tax(),
        total: this.total(),
      };

      const order = await this.orders.placeOrder(payload, this.cart.lines());
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
}