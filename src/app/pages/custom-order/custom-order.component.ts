import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { OrdersService, toErrorMessage } from '../../services/orders.service';

@Component({
  selector: 'app-custom-order',
  imports: [RouterLink, IonButton, IonContent, IonHeader, IonInput, IonMenuButton, IonTitle, IonToolbar],
  templateUrl: './custom-order.component.html',
})
export class CustomOrderComponent {
  private readonly orders = inject(OrdersService);
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;

  readonly name = signal('');
  readonly phone = signal('');
  readonly description = signal('');
  readonly quantity = signal('1');
  readonly deadline = signal('');

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly errors = computed(() => {
    const errs: Partial<Record<'name' | 'phone' | 'description' | 'quantity', string>> = {};
    if (this.name().trim().length < 2) errs.name = 'Please enter your name.';
    if (!/^(?:63|0)?9\d{9}$/.test(this.phone().replace(/\D/g, '')))
      errs.phone = 'Enter a valid mobile number (e.g. 09171234567).';
    if (this.description().trim().length < 10)
      errs.description = 'Please describe your custom order (at least 10 characters).';
    const q = Number(this.quantity());
    if (isNaN(q) || q < 1 || !Number.isInteger(q)) errs.quantity = 'Quantity must be at least 1.';
    return errs;
  });

  constructor() {
    const name = this.auth.user()?.displayName;
    if (typeof name === 'string' && name.trim().length >= 2) this.name.set(name.trim());
  }

  async submit(): Promise<void> {
    if (Object.keys(this.errors()).length > 0 || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.orders.placeCustomOrder({
        name: this.name().trim(),
        phone: this.phone().trim(),
        description: this.description().trim(),
        quantity: Number(this.quantity()),
        deadline: this.deadline() || null,
      });
      this.submitted.set(true);
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    } finally {
      this.submitting.set(false);
    }
  }
}