import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonBadge,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { NotificationsService } from '../../services/notifications.service';
import { addIcons } from 'ionicons';
import {
  bagHandleOutline,
  codeSlashOutline,
  colorPaletteOutline,
  informationCircleOutline,
  logInOutline,
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
  pricetagOutline,
  shieldCheckmarkOutline,
  starOutline,
  storefrontOutline,
  clipboardOutline,
  mailOutline,
  nutritionOutline,
  personCircleOutline as personOutline,
  callOutline,
} from 'ionicons/icons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppPage {
  title: string;
  url: string;
  icon: string;
  staffOnly?: boolean;
  group: 'Shop' | 'Account' | 'Info' | 'Admin';
}

// ─── Navigation Map ──────────────────────────────────────────────────────────

const appPages: AppPage[] = [
  { title: 'Bread Catalog',        url: '/bread-catalog',    icon: storefrontOutline,      group: 'Shop' },
  { title: 'Custom Order',         url: '/custom-order',     icon: colorPaletteOutline,    group: 'Shop' },
  { title: 'My Orders & Cart',     url: '/orders',           icon: bagHandleOutline,       group: 'Shop' },
  { title: 'My Account',           url: '/profile',          icon: personCircleOutline,    group: 'Account' },
  { title: 'Notifications',        url: '/notifications',    icon: notificationsOutline,   group: 'Account' },
  { title: 'Promotions & Offers',  url: '/promotions',       icon: pricetagOutline,        group: 'Info' },
  { title: 'Customer Feedback',    url: '/feedback',         icon: starOutline,           group: 'Info' },
  { title: 'About Our Products',   url: '/about-products',   icon: nutritionOutline,     group: 'Info' },
  { title: 'Contact Us',           url: '/contact-us',       icon: mailOutline,            group: 'Info' },
  { title: 'Developers',           url: '/developers',       icon: codeSlashOutline,       group: 'Info' },
  { title: 'Order Management',     url: '/order-oversight',  icon: clipboardOutline,       group: 'Admin', staffOnly: true },
  { title: 'Admin Management',     url: '/admin',            icon: shieldCheckmarkOutline, group: 'Admin', staffOnly: true },
];

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-menu',
  imports: [
    RouterLink,
    IonBadge,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
  ],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);

  readonly logOutOutline = logOutOutline;
  readonly logInOutline = logInOutline;
  readonly personOutline = personOutline;
  readonly callOutline = callOutline;
  readonly isLoggingOut = signal(false);

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly canManageProducts = this.auth.canManageProducts;

  /** Unread notification count for the nav badge (0 → badge hidden). */
  readonly unreadCount = this.notifications.unreadCount;

  /** Cart item count for badge on My Orders menu item. */
  readonly itemCount = this.cart.itemCount;

  private readonly unsubscribe: (() => void) | null;

  constructor() {
    addIcons({
      bagHandleOutline,
      codeSlashOutline,
      colorPaletteOutline,
      informationCircleOutline,
      logInOutline,
      logOutOutline,
      notificationsOutline,
      personCircleOutline,
      pricetagOutline,
      shieldCheckmarkOutline,
      starOutline,
      storefrontOutline,
      clipboardOutline,
      mailOutline,
      nutritionOutline,
      callOutline,
    });

    // Keep the badge live via realtime changes…
    this.unsubscribe = this.notifications.subscribe(() => void this.refreshUnread());
    // …and refresh whenever the auth state flips (e.g. right after login).
    effect(() => {
      if (this.isAuthenticated()) void this.refreshUnread();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  private async refreshUnread(): Promise<void> {
    try {
      await this.notifications.refresh();
    } catch {
      // badge is cosmetic — never block navigation on a refresh failure
    }
  }

  /** Hide staff-only entries unless the current role may manage products. */
  readonly visiblePages = computed(() =>
    appPages.filter((p) => !p.staffOnly || this.canManageProducts())
  );

  /** Pages grouped by section label for the sidebar (Shop / Account / Info / Admin). */
  readonly groupedPages = computed(() => {
    const pages = this.visiblePages();
    const order: AppPage['group'][] = ['Shop', 'Account', 'Info', 'Admin'];
    return order
      .filter((label) => pages.some((p) => p.group === label))
      .map((label) => ({ label, pages: pages.filter((p) => p.group === label) }));
  });

  isActive(page: AppPage): boolean {
    return this.router.url === page.url;
  }

  handleLogout(): void {
    this.isLoggingOut.set(true);
    void this.auth.signOut().finally(() => this.isLoggingOut.set(false));
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}