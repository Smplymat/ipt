import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonButton, IonBadge, IonRouterLink, IonMenuButton } from '@ionic/angular';
import { Router } from '@angular/router';
import { NotificationsService } from '../../../services/notifications.service';

@Component({
  selector: 'ktk-page-header',
  standalone: true,
  imports: [RouterLink, IonIcon, IonButton, IonBadge, IonRouterLink, IonMenuButton],
  template: `
    <header class="ktk-page-header" [class.transparent]="transparent" [class.has-back]="showBack">
      <!-- Back button or Menu button -->
      @if (showBack) {
        <a
          [routerLink]="backRoute"
          class="header-btn header-back"
          (click)="onBack($event)"
          aria-label="Go back">
          <ion-icon name="chevron-back-outline" slot="icon-only" aria-hidden="true"></ion-icon>
        </a>
      } @else {
        <ion-menu-button class="header-btn header-menu" aria-label="Open menu"></ion-menu-button>
      }

      <!-- Title -->
      <h1 class="header-title">{{ title }}</h1>

      <!-- Right side actions -->
      <div class="header-actions">
        @if (showNotifications) {
          <ion-router-link routerLink="/notifications" class="header-btn header-notif" aria-label="Notifications">
            <ion-icon name="notifications-outline" slot="icon-only" aria-hidden="true"></ion-icon>
            @if (unreadCount() > 0) {
              <ion-badge class="notif-badge" color="warning">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</ion-badge>
            }
          </ion-router-link>
        }
        @if (actionIcon) {
          <ion-button fill="clear" class="header-btn header-action" (click)="actionClick.emit()" aria-label="Action">
            <ion-icon [name]="actionIcon" slot="icon-only" aria-hidden="true"></ion-icon>
          </ion-button>
        }
      </div>
    </header>
  `,
  styles: [`
    .ktk-page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ktk-space-2);
      padding: var(--ktk-space-3) var(--ktk-space-4);
      min-height: 56px;
      background: var(--ktk-primary);
      color: var(--ktk-primary-contrast);
      position: sticky;
      top: 0;
      z-index: var(--ktk-z-sticky);
      border-bottom: 1px solid var(--ktk-primary);
    }

    .ktk-page-header.transparent {
      background: transparent;
      border-bottom: none;
      color: var(--ktk-text);
    }

    .header-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      --background: transparent;
      --color: inherit;
      --border-radius: var(--ktk-radius-button);
      --padding: 8px;
      min-width: 44px;
      min-height: 44px;
      text-decoration: none;

      &:hover {
        --background: var(--ktk-muted-beige);
      }

      ion-icon {
        font-size: 1.25rem;
      }
    }

    .header-title {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-2xl);
      font-weight: var(--ktk-fw-extrabold);
      color: inherit;
      margin: 0;
      flex: 1;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ktk-page-header.transparent .header-title {
      color: var(--ktk-text);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--ktk-space-1);
    }

    .header-notif {
      position: relative;
    }

    .notif-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      --background: var(--ktk-accent);
      --color: var(--ktk-text-on-accent);
      font-size: 0.625rem;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      font-weight: var(--ktk-fw-bold);
    }
  `]
})
export class PageHeaderComponent {
  private readonly notifications = inject(NotificationsService);

  @Input() title = '';
  @Input() showBack = false;
  @Input() backRoute = '/';
  @Input() showNotifications = true;
  @Input() actionIcon = '';
  @Input() transparent = false;

  @Output() actionClick = new EventEmitter<void>();

  readonly unreadCount = this.notifications.unreadCount;

  onBack(event: Event): void {
    if (this.backRoute) {
      const router = inject(Router);
      event.preventDefault();
      router.navigate([this.backRoute]);
    } else {
      history.back();
    }
  }
}