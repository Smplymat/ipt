import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { closeOutline, createOutline, imageOutline, trashOutline } from 'ionicons/icons';
import { AppRole, AuthUser, AuthService } from '../../services/auth.service';
import { Product, ProductsService, toErrorMessage } from '../../services/products.service';

@Component({
  selector: 'app-admin',
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  private readonly productsService = inject(ProductsService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);

  readonly user = this.auth.user;
  readonly roleBadge = computed(() =>
    this.user()!.role === 'admin' ? 'Admin' : 'Store Admin'
  );

  readonly tab = signal<'products' | 'users'>('products');
  readonly canManageUsers = this.auth.isAdmin;

  // ── Products state ──────────────────────────────────────────────────────────

  readonly products = signal<Product[]>([]);
  readonly productsLoading = signal(true);
  readonly productsError = signal<string | null>(null);

  readonly categoryOptions = ['Breads', 'Pastries', 'Cakes', 'Cookies', 'Muffins', 'Seasonal'];

  // Create form
  readonly createName = signal('');
  readonly createCategory = signal('Breads');
  readonly createDescription = signal('');
  readonly createPrice = signal('');
  readonly createImageFile = signal<File | null>(null);
  readonly createImagePreview = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  // Edit state
  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editCategory = signal('');
  readonly editDescription = signal('');
  readonly editPrice = signal('');
  readonly editImageFile = signal<File | null>(null);
  readonly editImagePreview = signal<string | null>(null);
  readonly savingEdit = signal(false);

  // ── Users state (Admin only) ────────────────────────────────────────────────

  readonly users = signal<AuthUser[]>([]);
  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);
  readonly roleUpdatingId = signal<string | null>(null);

  constructor() {
    void this.loadProducts();
    if (this.canManageUsers()) void this.loadUsers();
  }

  // ── Data loaders ────────────────────────────────────────────────────────────

  async loadProducts(): Promise<void> {
    this.productsLoading.set(true);
    this.productsError.set(null);
    try {
      this.products.set(await this.productsService.list());
    } catch (err) {
      this.productsError.set(toErrorMessage(err));
    } finally {
      this.productsLoading.set(false);
    }
  }

  async loadUsers(): Promise<void> {
    this.usersLoading.set(true);
    this.usersError.set(null);
    try {
      this.users.set(await this.auth.listUsers());
    } catch (err) {
      this.usersError.set(toErrorMessage(err));
    } finally {
      this.usersLoading.set(false);
    }
  }

  // ── Display helpers ─────────────────────────────────────────────────────────

  selectValue(event: Event): string {
    return (event.target as HTMLSelectElement)?.value ?? '';
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  formattedDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  ratingStars(r: number): string {
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  }

  roleLabel(role: string): string {
    return role === 'admin' ? 'Admin' : role === 'store_admin' ? 'Store Admin' : 'Customer';
  }

  // ── Create product ──────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.createImageFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.createImagePreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  clearCreateImage(): void {
    this.createImageFile.set(null);
    this.createImagePreview.set(null);
  }

  resetCreateForm(): void {
    this.createName.set('');
    this.createCategory.set('Breads');
    this.createDescription.set('');
    this.createPrice.set('');
    this.createImageFile.set(null);
    this.createImagePreview.set(null);
  }

  async handleCreate(): Promise<void> {
    const name = this.createName().trim();
    const price = Number(this.createPrice());
    if (!name) return this.formError.set('Please enter a product name.');
    if (this.createPrice() === '' || isNaN(price) || price < 0)
      return this.formError.set('Please enter a valid price.');
    if (!this.createImageFile())
      return this.formError.set('Please choose a product image.');

    this.saving.set(true);
    this.formError.set(null);
    try {
      const imageUrl = await this.productsService.uploadImage(this.createImageFile()!);
      const product = await this.productsService.create({
        name,
        category: this.createCategory(),
        description: this.createDescription().trim(),
        price,
        rating: 4.8,
        image_url: imageUrl,
      });
      this.products.update((list) => [product, ...list]);
      this.resetCreateForm();
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  // ── Edit product ────────────────────────────────────────────────────────────

  startEdit(p: Product): void {
    this.editingId.set(p.id);
    this.editName.set(p.name);
    this.editCategory.set(p.category);
    this.editDescription.set(p.description);
    this.editPrice.set(String(p.price));
    this.editImageFile.set(null);
    this.editImagePreview.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editImageFile.set(null);
    this.editImagePreview.set(null);
  }

  onEditFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.editImageFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.editImagePreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  async handleUpdate(p: Product): Promise<void> {
    const name = this.editName().trim();
    const price = Number(this.editPrice());
    if (!name) return this.formError.set('Please enter a product name.');
    if (this.editPrice() === '' || isNaN(price) || price < 0)
      return this.formError.set('Please enter a valid price.');

    this.savingEdit.set(true);
    this.formError.set(null);
    try {
      let imageUrl = p.image_url;
      if (this.editImageFile()) {
        const newUrl = await this.productsService.uploadImage(this.editImageFile()!);
        // Replacing the old image is best-effort: Store Admins may upload new
        // images but only Admins may delete stored files.
        await this.productsService.deleteImageByUrl(p.image_url).catch(() => undefined);
        imageUrl = newUrl;
      }
      const updated = await this.productsService.update(p.id, {
        name,
        category: this.editCategory(),
        description: this.editDescription().trim(),
        price,
        image_url: imageUrl,
      });
      this.products.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      this.cancelEdit();
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    } finally {
      this.savingEdit.set(false);
    }
  }

  // ── Delete product (Admin only) ─────────────────────────────────────────────

  async confirmDelete(p: Product): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete product',
      message: `Delete "${p.name}"? The product record and its image will be permanently removed.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'delete-button',
          handler: () => void this.handleDelete(p),
        },
      ],
    });
    await alert.present();
  }

  private async handleDelete(p: Product): Promise<void> {
    try {
      await this.productsService.remove(p.id);
      await this.productsService.deleteImageByUrl(p.image_url).catch(() => undefined);
      this.products.update((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    }
  }

  // ── Role management ─────────────────────────────────────────────────────────

  async handleRoleChange(u: AuthUser, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const role = select.value as AppRole;
    if (role === u.role || !this.canManageUsers()) return;

    this.roleUpdatingId.set(u.id);
    try {
      await this.auth.updateUserRole(u.id, role);
      this.users.update((list) => list.map((x) => (x.id === u.id ? { ...x, role } : x)));
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: 'Could not update role',
        message: toErrorMessage(err),
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      this.roleUpdatingId.set(null);
    }
  }

  // ── Shared icons ───────────────────────────────────────────────────────────

  readonly closeIcon = closeOutline;
  readonly createIcon = createOutline;
  readonly trashIcon = trashOutline;
  readonly imageIcon = imageOutline;
}