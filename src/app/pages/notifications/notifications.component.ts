import { Component, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  AppNotification,
  notificationIcon,
  NotificationsService,
} from '../../services/notifications.service';
import { toErrorMessage } from '../../services/orders.service';

@Component({
  selector: 'app-notifications',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar],
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent implements OnDestroy {
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);

  readonly items = this.notifications.items;
  readonly loaded = this.notifications.loaded;
  readonly unreadCount = this.notifications.unreadCount;

  errorMessage: string | null = null;
  actionsError: string | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    void this.refresh();
    this.unsubscribe = this.notifications.subscribe(() => {
      void this.refresh();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  notificationIcon(type: string): string {
    return notificationIcon(type as AppNotification['type']);
  }

  async refresh(): Promise<void> {
    try {
      await this.notifications.refresh();
      this.errorMessage = null;
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
    }
  }

  async open(item: AppNotification): Promise<void> {
    try {
      if (!item.read) await this.notifications.markRead(item.id);
    } catch (err) {
      this.actionsError = toErrorMessage(err);
      return;
    }
    if (item.link) await this.router.navigateByUrl(item.link);
  }

  async markAllRead(): Promise<void> {
    try {
      await this.notifications.markAllRead();
      this.actionsError = null;
    } catch (err) {
      this.actionsError = toErrorMessage(err);
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}