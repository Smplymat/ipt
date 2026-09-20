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
import { NotificationsService } from '../../services/notifications.service';
import {
  bagHandleOutline,
  codeSlashOutline,
  colorPaletteOutline,
  gridOutline,
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
} from 'ionicons/icons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppPage {
  title: string;
  url: string;
  icon: string;
  staffOnly?: boolean;
}

// ─── Navigation Map ──────────────────────────────────────────────────────────

const appPages: AppPage[] = [
  { title: 'Dashboard',            url: '/dashboard',        icon: gridOutline },
  { title: 'Bread Catalog',        url: '/bread-catalog',    icon: storefrontOutline },
  { title: 'Custom Order',         url: '/custom-order',     icon: colorPaletteOutline },
  { title: 'My Orders & Cart',     url: '/orders',           icon: bagHandleOutline },
  { title: 'Notifications',        url: '/notifications',    icon: notificationsOutline },
  { title: 'My Account',           url: '/profile',          icon: personCircleOutline },
  { title: 'Promotions & Offers',  url: '/promotions',       icon: pricetagOutline },
  { title: 'Customer Feedback',    url: '/feedback',         icon: starOutline },
  { title: 'About Knead to Know',  url: '/about',            icon: informationCircleOutline },
  { title: 'Developers',           url: '/developers',       icon: codeSlashOutline },
  { title: 'Order Management',     url: '/order-oversight',  icon: clipboardOutline,  staffOnly: true },
  { title: 'Admin Management',     url: '/admin',            icon: shieldCheckmarkOutline, staffOnly: true },
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
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);

  readonly logOutOutline = logOutOutline;
  readonly logInOutline = logInOutline;
  readonly isLoggingOut = signal(false);

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly canManageProducts = this.auth.canManageProducts;

  /** Unread notification count for the nav badge (0 → badge hidden). */
  readonly unreadCount = this.notifications.unreadCount;

  private readonly unsubscribe: (() => void) | null;

  constructor() {
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

  isActive(page: AppPage): boolean {
    return this.router.url === page.url;
  }

  handleLogout(): void {
    this.isLoggingOut.set(true);
    void this.auth.signOut().finally(() => this.isLoggingOut.set(false));
  }
}