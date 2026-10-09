import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { PaymentService, PaymentMethod } from '../../services/payment.service';
import { checkmarkCircleOutline, alertCircleOutline, timeOutline, arrowForwardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-payment-success',
  imports: [
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './payment-success.component.html',
})
export class PaymentSuccessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly payment = inject(PaymentService);

  readonly orderId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly paymentStatus = signal<'paid' | 'pending' | 'failed' | 'unknown'>('unknown');
  readonly paymentMethod = signal<PaymentMethod | null>(null);
  readonly error = signal<string | null>(null);

  readonly checkmarkCircle = checkmarkCircleOutline;
  readonly alertCircle = alertCircleOutline;
  readonly timeOutline = timeOutline;
  readonly arrowForward = arrowForwardOutline;

  constructor() {
    const id = this.route.snapshot.queryParamMap.get('order_id');
    if (id) {
      this.orderId.set(id);
      this.checkStatus(id);
    } else {
      this.loading.set(false);
      this.error.set('Order reference missing.');
    }
  }

  private async checkStatus(orderId: string): Promise<void> {
    this.loading.set(true);
    try {
      const status = await this.payment.checkPaymentStatus(orderId);
      if (status) {
        this.paymentMethod.set(status.payment_method as PaymentMethod);
        switch (status.payment_status) {
          case 'paid':
            this.paymentStatus.set('paid');
            break;
          case 'pending':
            this.paymentStatus.set('pending');
            break;
          case 'failed':
            this.paymentStatus.set('failed');
            break;
          default:
            this.paymentStatus.set('unknown');
        }
      } else {
        this.paymentStatus.set('unknown');
      }
    } catch {
      this.paymentStatus.set('unknown');
    } finally {
      this.loading.set(false);
    }
  }

  getMethodLabel(method: PaymentMethod | null): string {
    const labels: Record<PaymentMethod, string> = {
      cod: 'Cash on Delivery',
      card: 'Credit/Debit Card',
      gcash: 'GCash',
      paymaya: 'Maya',
      grab_pay: 'GrabPay',
    };
    return method ? labels[method] : 'Unknown';
  }

  getStatusMessage(): string {
    switch (this.paymentStatus()) {
      case 'paid':
        return 'Your payment was successful! Your order is confirmed.';
      case 'pending':
        return 'Your payment is being processed. We\'ll notify you once confirmed.';
      case 'failed':
        return 'Payment could not be completed. Please try again or choose another method.';
      default:
        return 'Checking payment status...';
    }
  }

  getStatusColor(): string {
    switch (this.paymentStatus()) {
      case 'paid': return 'var(--bakery-status-finished)';
      case 'pending': return 'var(--bakery-burnt)';
      case 'failed': return 'var(--bakery-error)';
      default: return 'var(--bakery-dark)';
    }
  }

  getStatusIcon(): string {
    switch (this.paymentStatus()) {
      case 'paid': return this.checkmarkCircle;
      case 'pending': return this.timeOutline;
      case 'failed': return this.alertCircle;
      default: return this.timeOutline;
    }
  }
}