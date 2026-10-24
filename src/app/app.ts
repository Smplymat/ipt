import { Component, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { IonApp, IonRouterOutlet, IonSplitPane } from '@ionic/angular';
import { MenuComponent } from './components/menu/menu.component';
import { SplashScreenComponent } from './components/splash-screen/splash-screen.component';
import { FloatingCartBarComponent } from './shared/components/floating-cart-bar/floating-cart-bar.component';
import { registerAllIcons } from './shared/icon-registry';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonSplitPane, IonRouterOutlet, MenuComponent, SplashScreenComponent, FloatingCartBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  constructor() {
    // Register all Ionicons once at startup to avoid "unregistered icon" warnings
    registerAllIcons();

    // In the installed mobile app, PayMongo's "Return to merchant" ends up at
    //   com.kneadtoknow.app://payment-return?status=success&order_id=...
    // (via the payment-return Edge Function). Android opens the app with that
    // link; send the customer to the matching receipt / cancelled page.
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', (event) => {
        this.zone.run(() => this.handlePaymentDeepLink(event.url));
      });
    }
  }

  private handlePaymentDeepLink(rawUrl: string): void {
    try {
      const url = new URL(rawUrl);
      if (url.host !== 'payment-return') return;

      const orderId = url.searchParams.get('order_id');
      const status = url.searchParams.get('status');

      // Close the in-app browser tab if the platform leaves it open.
      Browser.close().catch(() => undefined);

      if (!orderId) return;
      void this.router.navigate(
        [status === 'cancelled' ? '/payment-cancelled' : '/payment-success'],
        { queryParams: { order_id: orderId } },
      );
    } catch {
      // Not a link we understand; ignore it.
    }
  }
}
