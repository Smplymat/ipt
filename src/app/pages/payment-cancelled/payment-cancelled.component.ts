import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { arrowBackOutline, arrowForwardOutline, closeCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-payment-cancelled',
  imports: [
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
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