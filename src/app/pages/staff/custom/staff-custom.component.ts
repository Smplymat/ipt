import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonIcon, IonMenuButton, IonTitle, IonToolbar, ToastController } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { OrdersService, toErrorMessage } from '../../../services/orders.service';

import {
  ButtonComponent,
  ChipComponent,
  TicketCardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  SkeletonComponent,
  PageHeaderComponent,
} from '../../../shared';

import { addIcons } from 'ionicons';
import { searchOutline, filterOutline, timeOutline, checkmarkOutline, closeOutline } from 'ionicons/icons';

type CustomOrdersTab = 'all' | 'new' | 'approved' | 'declined';

@Component({
  selector: 'app-staff-custom',
  imports: [
    IonContent,
    IonIcon,
    ButtonComponent,
    ChipComponent,
    TicketCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
  ],
  templateUrl: './staff-custom.component.html',
  styleUrl: './staff-custom.component.scss',
})
export class StaffCustomComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastController);

  readonly customOrders = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly activeTab = signal<CustomOrdersTab>('all');

  readonly statusOptions: CustomOrdersTab[] = ['all', 'new', 'approved', 'declined'];

  constructor() {
    addIcons({ searchOutline, filterOutline, timeOutline, checkmarkOutline, closeOutline });
    void this.loadCustomOrders();
  }

  async loadCustomOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.customOrders.set(await this.ordersService.getCustomOrders());
    } catch (err) {
      this.error.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  readonly filteredOrders = computed(() => {
    const tab = this.activeTab();
    const list = this.customOrders();
    if (tab === 'all') return list;
    return list.filter(o => o.status === tab);
  });

  get emptyStateTitle(): string {
    return 'No ' + this.activeTab() + ' custom orders';
  }

  get emptyStateDescription(): string {
    return 'No custom orders with status "' + this.activeTab() + '" at the moment.';
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  shortId(order: any): string {
    return '#' + order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'new': return 'var(--ktk-accent)';
      case 'approved': return 'var(--ktk-success)';
      case 'declined': return 'var(--ktk-error)';
      default: return 'var(--ktk-text)';
    }
  }

  getTicketActions(order: any) {
    const actions = [];

    if (order.status === 'new') {
      actions.push({
        label: 'Approve',
        variant: 'accent' as const,
        icon: 'checkmark-outline',
        action: 'approve',
      });
      actions.push({
        label: 'Decline',
        variant: 'danger' as const,
        icon: 'close-outline',
        action: 'decline',
      });
    }

    return actions;
  }

  handleAction(action: string, order: any): void {
    switch (action) {
      case 'approve':
        this.updateCustomOrderStatus(order.id, 'approved');
        break;
      case 'decline':
        this.updateCustomOrderStatus(order.id, 'declined');
        break;
    }
  }

  async updateCustomOrderStatus(orderId: string, status: 'approved' | 'declined'): Promise<void> {
    try {
      await this.ordersService.updateCustomOrderStatus(orderId, status);
      this.customOrders.update(list => list.map(o => o.id === orderId ? { ...o, status } : o));
      this.showToast(`Custom order ${status}`, 'success');
    } catch (err) {
      this.error.set(toErrorMessage(err));
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary'): Promise<void> {
    const toast = await this.toast.create({ message, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}