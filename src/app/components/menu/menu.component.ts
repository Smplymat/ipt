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
import { AuthService, AppRole } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { NotificationsService } from '../../services/notifications.service';

interface AppPage {
  title: string;
  url: string;
  icon: string;
  roles?: AppRole[]; // Roles allowed to see this page
  group: 'Shop' | 'Account' | 'Info' | 'Staff' | 'Admin';
}

const appPages: AppPage[] = [
  // Shop section - visible to customers and staff
  { title: 'Shop',           url: '/bread-catalog',   icon: 'storefront-outline',   roles: ['customer', 'store_admin'], group: 'Shop' },
  { title: 'Custom Order',   url: '/custom-order',    icon: 'color-palette-outline', roles: ['customer', 'store_admin'], group: 'Shop' },
  { title: 'My Orders',      url: '/orders',          icon: 'bag-handle-outline',   roles: ['customer', 'store_admin'], group: 'Shop' },

  // Account section - visible to all authenticated users
  { title: 'My Account',     url: '/profile',         icon: 'person-circle-outline', roles: ['customer', 'store_admin', 'admin'], group: 'Account' },
  { title: 'Notifications',  url: '/notifications',   icon: 'notifications-outline', roles: ['customer', 'store_admin', 'admin'], group: 'Account' },

  // Info section - visible to all
  { title: 'Promotions',     url: '/promotions',      icon: 'pricetag-outline',     roles: ['customer', 'store_admin', 'admin'], group: 'Info' },
  { title: 'Reviews',        url: '/feedback',        icon: 'star-outline',         roles: ['customer', 'store_admin', 'admin'], group: 'Info' },
  { title: 'Our Craft',      url: '/about-products',  icon: 'nutrition-outline',    roles: ['customer', 'store_admin', 'admin'], group: 'Info' },
  { title: 'Contact Us',     url: '/contact-us',      icon: 'mail-outline',         roles: ['customer', 'store_admin', 'admin'], group: 'Info' },
  { title: 'Developers',     url: '/developers',      icon: 'code-slash-outline',   roles: ['customer', 'store_admin', 'admin'], group: 'Info' },

  // Staff section - visible to store_admin only
  { title: 'Products',       url: '/staff/products',  icon: 'cube-outline',         roles: ['store_admin'], group: 'Staff' },
  { title: 'Inventory',      url: '/staff/inventory', icon: 'clipboard-outline',    roles: ['store_admin'], group: 'Staff' },
  { title: 'Fulfillment',    url: '/staff/orders',    icon: 'receipt-outline',      roles: ['store_admin'], group: 'Staff' },
  { title: 'Custom Orders',  url: '/staff/custom',    icon: 'color-palette-outline', roles: ['store_admin'], group: 'Staff' },

  // Admin section - visible to admin only
  { title: 'User Management', url: '/admin/users',    icon: 'people-outline',       roles: ['admin'], group: 'Admin' },
];

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

  readonly isLoggingOut = signal(false);

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly canManageProducts = this.auth.canManageProducts;

  /** Unread notification count for the nav badge (0 → badge hidden). */
  readonly unreadCount = this.notifications.unreadCount;

  /** Cart item count for badge on My Orders menu item. */
  readonly itemCount = this.cart.itemCount;

  readonly logOutOutline = 'log-out-outline';
  readonly logInOutline = 'log-in-outline';

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

  /** Role label for display. */
  roleLabel(role: AppRole): string {
    return role === 'admin' ? 'Admin' : role === 'store_admin' ? 'Staff' : 'Customer';
  }

  /** Hide pages unless the current user has one of the allowed roles. */
  readonly visiblePages = computed(() => {
    const user = this.user();
    const userRole: AppRole = user?.role ?? 'customer';
    return appPages.filter((p) => !p.roles || p.roles.includes(userRole));
  });

  /** Pages grouped by section label for the sidebar. */
  readonly groupedPages = computed(() => {
    const pages = this.visiblePages();
    const order: AppPage['group'][] = ['Shop', 'Account', 'Info', 'Staff', 'Admin'];
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