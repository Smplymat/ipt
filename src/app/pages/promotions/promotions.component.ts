import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROMOS = [
  { id: 1, badge: 'Flash Deal', title: '20% Off All Croissants', desc: 'Grab your favourite flaky pastries at a special price. Valid every Tuesday until end of month.', code: 'CROIST20', accent: 'coral' as const, expiry: 'Ends Sep 30' },
  { id: 2, badge: 'Weekend Special', title: 'Buy 2 Cakes, Get 1 Free', desc: 'Perfect for celebrations! Mix and match any whole cakes from our catalog.', code: 'CAKE3FOR2', accent: 'brown' as const, expiry: 'Sat & Sun only' },
  { id: 3, badge: 'Loyalty Reward', title: '₱50 Off Your 5th Order', desc: 'Our way of saying thank you. Discount applied automatically at checkout.', code: 'AUTO-APPLIED', accent: 'yellow' as const, expiry: 'Always active' },
  { id: 4, badge: 'New Member', title: 'First Order 15% Discount', desc: 'Welcome to Knead to Know! Enjoy 15% off your very first order with us.', code: 'WELCOME15', accent: 'coral' as const, expiry: 'One-time use' },
  { id: 5, badge: 'Bulk Order', title: 'Free Delivery on ₱500+', desc: "Order ₱500 or more and we'll deliver right to your door for free.", code: 'FREEDEL500', accent: 'brown' as const, expiry: 'Ongoing' },
];

const FEATURED_IMG = 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=480&h=260&fit=crop&auto=format';

@Component({
  selector: 'app-promotions',
  imports: [
    CommonModule,
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './promotions.component.html',
})
export class PromotionsComponent {
  readonly promos = PROMOS;
  readonly featuredImg = FEATURED_IMG;

  readonly copied = signal<string | null>(null);

  handleCopy(code: string): void {
    navigator.clipboard.writeText(code).catch(() => {});
    this.copied.set(code);
    setTimeout(() => this.copied.set(null), 2000);
  }
}