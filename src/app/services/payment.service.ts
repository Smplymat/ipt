import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import { environment } from '../../environments/environment';

export type PaymentMethod = 'cod' | 'card' | 'gcash' | 'paymaya' | 'grab_pay';

export interface CreatePaymentResponse {
  success: boolean;
  checkout_url?: string;
  paymongo_reference?: string;
  payment_method?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly db = inject(DatabaseService);

  /**
   * Creates a payment session for the given order.
   * For COD, returns success immediately.
   * For online methods, returns a checkout_url to redirect the user.
   */
  async createPayment(orderId: string, paymentMethod: PaymentMethod): Promise<CreatePaymentResponse> {
    const { data: { session } } = await this.db.client.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    const functionsUrl = `${environment.supabaseUrl}/functions/v1/create-payment`;

    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ order_id: orderId, payment_method: paymentMethod }),
    });

    const result = await response.json() as CreatePaymentResponse;

    if (!response.ok) {
      return { success: false, error: result.error || 'Payment initialization failed' };
    }

    return result;
  }

  /**
   * Checks the payment status of an order by querying the database directly.
   * Used by payment-success and payment-cancelled pages.
   */
  async checkPaymentStatus(orderId: string): Promise<{ payment_status: string; payment_method: string } | null> {
    const { data, error } = await this.db.client
      .from('orders')
      .select('payment_status, payment_method')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      payment_status: data.payment_status,
      payment_method: data.payment_method,
    };
  }
}