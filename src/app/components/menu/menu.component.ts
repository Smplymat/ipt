import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import {
  bagHandleOutline,
  codeSlashOutline,
  gridOutline,
  informationCircleOutline,
  logInOutline,
  logOutOutline,
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
  { title: 'My Orders & Cart',     url: '/orders',           icon: bagHandleOutline },
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
export class MenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly logOutOutline = logOutOutline;
  readonly logInOutline = logInOutline;
  readonly isLoggingOut = signal(false);

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly canManageProducts = this.auth.canManageProducts;

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