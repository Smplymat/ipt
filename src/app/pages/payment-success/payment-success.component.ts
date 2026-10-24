import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { PaymentService, PaymentMethod } from '../../services/payment.service';
import { CartService } from '../../services/cart.service';

import {
  ButtonComponent,
  ErrorStateComponent,
  PageHeaderComponent,
  SkeletonComponent,
  TicketCardComponent,
} from '../../shared';

@Component({
  selector: 'app-payment-success',
  imports: [
    RouterLink,
    IonContent,
    IonIcon,
    ButtonComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
    TicketCardComponent,
  ],
  templateUrl: './payment-success.component.html',
})
export class PaymentSuccessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly payment = inject(PaymentService);
  private readonly cart = inject(CartService);

  readonly orderId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly paymentStatus = signal<'paid' | 'pending' | 'failed' | 'unknown'>('unknown');
  readonly paymentMethod = signal<'cod' | 'card' | 'gcash' | 'paymaya' | 'grab_pay' | null>(null);
  readonly error = signal<string | null>(null);

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
      let status = await this.payment.checkPaymentStatus(orderId);
      // The PayMongo webhook can arrive a few seconds after the customer
      // returns, so re-check a few times while the payment is still pending.
      for (let i = 0; i < 5 && status?.payment_status === 'pending'; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        status = await this.payment.checkPaymentStatus(orderId);
      }
      if (status) {
        this.paymentMethod.set(status.payment_method as 'cod' | 'card' | 'gcash' | 'paymaya' | 'grab_pay');
        switch (status.payment_status) {
          case 'paid':
            this.paymentStatus.set('paid');
            // The order is paid, so the basket is no longer needed.
            void this.cart.clear();
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

  getMethodLabel(method: 'cod' | 'card' | 'gcash' | 'paymaya' | 'grab_pay' | null): string {
    const labels: Record<string, string> = {
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
      case 'paid': return 'var(--ktk-status-finished)';
      case 'pending': return 'var(--ktk-burnt)';
      case 'failed': return 'var(--ktk-error)';
      default: return 'var(--ktk-text)';
    }
  }

  getStatusIcon(): string {
    switch (this.paymentStatus()) {
      case 'paid': return 'checkmark-circle-outline';
      case 'pending': return 'time-outline';
      case 'failed': return 'alert-circle-outline';
      default: return 'time-outline';
    }
  }

  /** Build ticket actions. */
  getActions() {
    return [
      {
        label: 'View My Orders',
        variant: 'accent' as const,
        icon: 'arrow-forward-outline',
        action: 'view-orders',
      },
      {
        label: 'Continue Shopping',
        variant: 'outline' as const,
        icon: 'storefront-outline',
        action: 'continue-shopping',
      },
    ];
  }

  /** Handle ticket action clicks. */
  handleAction(action: string): void {
    // Navigation handled by routerLink
  }

  /** Handle ticket action clicks (accepts any for template compatibility). */
  handleTicketAction(action: unknown): void {
    this.handleAction(action as string);
  }
}