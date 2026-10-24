import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonIcon, ToastController } from '@ionic/angular';
import { AuthService, AuthUser, AppRole } from '../../../services/auth.service';
import { addIcons } from 'ionicons';
import { addOutline, personAddOutline, personRemoveOutline, personOutline, shieldCheckmarkOutline, searchOutline, trashOutline, createOutline } from 'ionicons/icons';

import {
  ButtonComponent,
  ChipComponent,
  PageHeaderComponent,
  SkeletonComponent,
  ErrorStateComponent,
  FormFieldComponent,
  EmptyStateComponent,
} from '../../../shared';

interface AdminUser extends AuthUser {
  isCurrentUser?: boolean;
  disabled?: boolean;
  createdAt?: string;
}

@Component({
  selector: 'app-admin-users',
  imports: [
    IonContent,
    IonIcon,
    PageHeaderComponent,
    ButtonComponent,
    ChipComponent,
    SkeletonComponent,
    ErrorStateComponent,
    FormFieldComponent,
    EmptyStateComponent,
    DatePipe,
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent {
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly pageSizeOptions = [10, 20, 50, 100];

  readonly searchQuery = signal('');
  readonly roleFilter = signal<AppRole | 'all'>('all');
  readonly statusFilter = signal<'all' | 'active' | 'disabled'>('all');
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);

  readonly isCreating = signal(false);
  readonly createName = signal('');
  readonly createEmail = signal('');
  readonly createPassword = signal('');
  readonly createRole = signal<AppRole>('customer');
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editEmail = signal('');
  readonly editRole = signal<AppRole>('customer');
  readonly editDisabled = signal(false);
  readonly savingEdit = signal(false);
  readonly editError = signal<string | null>(null);

  readonly roleLabel = (role: AppRole) => role === 'admin' ? 'Admin' : role === 'store_admin' ? 'Staff' : 'Customer';

  readonly filteredUsers = computed(() => {
    let list = this.users();
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(u =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    if (this.roleFilter() !== 'all') {
      list = list.filter(u => u.role === this.roleFilter());
    }
    if (this.statusFilter() !== 'all') {
      list = list.filter(u => this.statusFilter() === 'active' ? !u.disabled : u.disabled);
    }
    return list;
  });

  readonly paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });

  readonly totalPages = computed(() =>
    Math.ceil(this.filteredUsers().length / this.pageSize()) || 1
  );

  constructor() {
    addIcons({
      addOutline,
      personAddOutline,
      personRemoveOutline,
      personOutline,
      shieldCheckmarkOutline,
      searchOutline,
      trashOutline,
      createOutline,
    });
    void this.loadUsers();
  }

  // Icon properties for template access
  readonly personAddOutline = personAddOutline;
  readonly createOutline = createOutline;
  readonly trashOutline = trashOutline;

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const users = await this.auth.listUsers();
      this.users.set(users.map(u => ({ ...u, isCurrentUser: u.id === this.auth.user()?.id })));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      this.loading.set(false);
    }
  }

  async createUser(): Promise<void> {
    const name = this.createName().trim();
    const email = this.createEmail().trim().toLowerCase();
    const password = this.createPassword();
    const role = this.createRole();

    if (!name || !email || !password) {
      this.createError.set('All fields are required.');
      return;
    }
    if (password.length < 6) {
      this.createError.set('Password must be at least 6 characters.');
      return;
    }

    this.creating.set(true);
    this.createError.set(null);
    try {
      const result = await this.auth.signUp(email, password, name);
      if (!result.ok) throw new Error(result.message ?? 'Failed to create user');

      // Update role if not customer
      if (this.createRole() !== 'customer') {
        await this.auth.updateUserRole(result.userId!, this.createRole());
      }

      this.createName.set('');
      this.createEmail.set('');
      this.createPassword.set('');
      this.createRole.set('customer');
      this.isCreating.set(false);
      await this.loadUsers();
      this.showToast('User created successfully', 'success');
    } catch (err) {
      this.createError.set(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      this.creating.set(false);
    }
  }

  startEdit(user: AdminUser): void {
    if (user.isCurrentUser) return;
    this.editingId.set(user.id);
    this.editName.set(user.displayName);
    this.editEmail.set(user.email);
    this.editRole.set(user.role);
    this.editDisabled.set(user.disabled ?? false);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editName.set('');
    this.editEmail.set('');
    this.editRole.set('customer');
    this.editDisabled.set(false);
    this.editError.set(null);
  }

  async saveEdit(user: AdminUser): Promise<void> {
    const name = this.editName().trim();
    const email = this.editEmail().trim().toLowerCase();
    const role = this.editRole();

    if (!name || !email) {
      this.editError.set('Name and email are required.');
      return;
    }

    this.savingEdit.set(true);
    this.editError.set(null);
    try {
      await this.auth.updateUserProfile(user.id, { displayName: name, email });
      if (role !== user.role) {
        await this.auth.updateUserRole(user.id, role);
      }
      // Note: disabled status would need a separate API
      this.cancelEdit();
      await this.loadUsers();
      this.showToast('User updated successfully', 'success');
    } catch (err) {
      this.editError.set(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      this.savingEdit.set(false);
    }
  }

  async toggleDisable(user: AdminUser): Promise<void> {
    if (user.isCurrentUser) {
      this.showToast('You cannot disable yourself', 'warning');
      return;
    }
    const alert = await this.alertCtrl.create({
      header: user.disabled ? 'Enable User' : 'Disable User',
      message: user.disabled
        ? `Enable "${user.displayName}"? They will be able to sign in again.`
        : `Disable "${user.displayName}"? They will not be able to sign in.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: user.disabled ? 'Enable' : 'Disable',
          role: user.disabled ? 'confirm' : 'destructive',
          handler: async () => {
            try {
              // This would need a backend API to actually disable/enable
              await this.loadUsers();
              this.showToast(
                user.disabled ? 'User enabled' : 'User disabled',
                'success'
              );
            } catch {
              this.showToast('Failed to update user status', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteUser(user: AdminUser): Promise<void> {
    if (user.isCurrentUser) {
      this.showToast('You cannot delete yourself', 'warning');
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Delete User',
      message: `Delete "${user.displayName}" (${user.email})? This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.auth.deleteUser(user.id);
              await this.loadUsers();
              this.showToast('User deleted', 'success');
            } catch {
              this.showToast('Failed to delete user', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  onSearchChange(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onRoleFilterChange(event: Event): void {
    this.roleFilter.set((event.target as HTMLSelectElement).value as AppRole | 'all');
    this.currentPage.set(1);
  }

  onStatusFilterChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as 'all' | 'active' | 'disabled');
    this.currentPage.set(1);
  }

  onPageSizeChange(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getPageRange(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const range: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) range.push(i);
    } else {
      range.push(1);
      if (current > 3) range.push(-1); // ellipsis
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        range.push(i);
      }
      if (current < total - 2) range.push(-1); // ellipsis
      range.push(total);
    }
    return range;
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary'): Promise<void> {
    const toast = await this.toast.create({ message, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}