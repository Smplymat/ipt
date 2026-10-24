import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';

import {
  ButtonComponent,
  PageHeaderComponent,
  TicketCardComponent,
} from '../../shared';

import { closeCircleOutline, arrowBackOutline, arrowForwardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-payment-cancelled',
  imports: [
    RouterLink,
    IonContent,
    IonIcon,
    ButtonComponent,
    PageHeaderComponent,
    TicketCardComponent,
  ],
  templateUrl: './payment-cancelled.component.html',
})
export class PaymentCancelledComponent {
  private readonly route = inject(ActivatedRoute);

  readonly orderId = signal<string | null>(null);

  readonly closeCircle = closeCircleOutline;
  readonly arrowBack = arrowBackOutline;
  readonly arrowForward = arrowForwardOutline;

  constructor() {
    const id = this.route.snapshot.queryParamMap.get('order_id');
    if (id) {
      this.orderId.set(id);
    }
  }
}