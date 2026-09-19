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
import { closeOutline, createOutline, imageOutline, trashOutline, addOutline } from 'ionicons/icons';
import { AppRole, AuthUser, AuthService } from '../../services/auth.service';
import { Product, ProductsService, toErrorMessage, ExtraInfoItem } from '../../services/products.service';
import { CategoriesService, Category } from '../../services/categories.service';

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
  private readonly categoriesService = inject(CategoriesService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);

  readonly user = this.auth.user;
  readonly roleBadge = computed(() =>
    this.user()!.role === 'admin' ? 'Admin' : 'Store Admin'
  );

  readonly tab = signal<'products' | 'categories' | 'users'>('products');
  readonly canManageUsers = this.auth.isAdmin;

  // ── Products state ──────────────────────────────────────────────────────────

  readonly products = signal<Product[]>([]);
  readonly productsLoading = signal(true);
  readonly productsError = signal<string | null>(null);

  // ── Categories state ────────────────────────────────────────────────────────

  readonly categories = signal<Category[]>([]);
  readonly categoriesLoading = signal(false);
  readonly categoriesError = signal<string | null>(null);
  readonly newCategoryName = signal('');
  readonly savingCategory = signal(false);
  readonly categoryFormError = signal<string | null>(null);

  /** Names list used for dropdowns — derived from live categories signal. */
  readonly categoryNames = computed(() =>
    this.categories().length > 0
      ? this.categories().map((c) => c.name)
      : ['Breads', 'Pastries', 'Cakes', 'Cookies', 'Muffins', 'Seasonal']
  );

  // ── Create form ─────────────────────────────────────────────────────────────

  readonly createName = signal('');
  readonly createCategory = signal('Breads');
  readonly createDescription = signal('');
  readonly createPrice = signal('');
  readonly createIngredients = signal('');
  readonly createNutritionalValue = signal('');
  readonly createExtraInfo = signal<ExtraInfoItem[]>([]);
  readonly createImageFile = signal<File | null>(null);
  readonly createImagePreview = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  // ── Edit state ──────────────────────────────────────────────────────────────

  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editCategory = signal('');
  readonly editDescription = signal('');
  readonly editPrice = signal('');
  readonly editIngredients = signal('');
  readonly editNutritionalValue = signal('');
  readonly editExtraInfo = signal<ExtraInfoItem[]>([]);
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
    void this.loadCategories();
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

  async loadCategories(): Promise<void> {
    this.categoriesLoading.set(true);
    this.categoriesError.set(null);
    try {
      this.categories.set(await this.categoriesService.list());
      // Keep createCategory pointing at a valid option after reload.
      if (!this.categoryNames().includes(this.createCategory())) {
        this.createCategory.set(this.categoryNames()[0] ?? 'Breads');
      }
    } catch (err) {
      this.categoriesError.set(toErrorMessage(err));
    } finally {
      this.categoriesLoading.set(false);
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

  // ── Category management ──────────────────────────────────────────────────────

  async handleCreateCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) return this.categoryFormError.set('Please enter a category name.');

    this.savingCategory.set(true);
    this.categoryFormError.set(null);
    try {
      const cat = await this.categoriesService.create(name);
      this.categories.update((list) => [...list, cat].sort((a, b) => a.name.localeCompare(b.name)));
      this.newCategoryName.set('');
    } catch (err) {
      this.categoryFormError.set(toErrorMessage(err));
    } finally {
      this.savingCategory.set(false);
    }
  }

  async confirmDeleteCategory(cat: Category): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete category',
      message: `Delete "${cat.name}"? Products assigned to this category will keep the name but it will no longer appear in the dropdown.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'delete-button',
          handler: () => void this.handleDeleteCategory(cat),
        },
      ],
    });
    await alert.present();
  }

  private async handleDeleteCategory(cat: Category): Promise<void> {
    try {
      await this.categoriesService.remove(cat.id);
      this.categories.update((list) => list.filter((c) => c.id !== cat.id));
    } catch (err) {
      this.categoryFormError.set(toErrorMessage(err));
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

  // ── Extra info dynamic fields (shared helper) ──────────────────────────────

  private newExtraItem(): ExtraInfoItem {
    return { id: crypto.randomUUID(), label: '', value: '' };
  }

  addCreateExtraItem(): void {
    this.createExtraInfo.update((list) => [...list, this.newExtraItem()]);
  }

  removeCreateExtraItem(id: string): void {
    this.createExtraInfo.update((list) => list.filter((i) => i.id !== id));
  }

  updateCreateExtraItem(id: string, field: 'label' | 'value', value: string): void {
    this.createExtraInfo.update((list) =>
      list.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  addEditExtraItem(): void {
    this.editExtraInfo.update((list) => [...list, this.newExtraItem()]);
  }

  removeEditExtraItem(id: string): void {
    this.editExtraInfo.update((list) => list.filter((i) => i.id !== id));
  }

  updateEditExtraItem(id: string, field: 'label' | 'value', value: string): void {
    this.editExtraInfo.update((list) =>
      list.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
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
    this.createCategory.set(this.categoryNames()[0] ?? 'Breads');
    this.createDescription.set('');
    this.createPrice.set('');
    this.createIngredients.set('');
    this.createNutritionalValue.set('');
    this.createExtraInfo.set([]);
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
        ingredients: this.createIngredients().trim(),
        nutritional_value: this.createNutritionalValue().trim(),
        extra_info: this.createExtraInfo().filter((i) => i.label.trim() || i.value.trim()),
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
    this.editIngredients.set(p.ingredients ?? '');
    this.editNutritionalValue.set(p.nutritional_value ?? '');
    // Ensure each item has a stable client-side id.
    this.editExtraInfo.set(
      (p.extra_info ?? []).map((i) => ({ ...i, id: i.id ?? crypto.randomUUID() }))
    );
    this.editImageFile.set(null);
    this.editImagePreview.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editImageFile.set(null);
    this.editImagePreview.set(null);
    this.editExtraInfo.set([]);
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
        await this.productsService.deleteImageByUrl(p.image_url).catch(() => undefined);
        imageUrl = newUrl;
      }
      const updated = await this.productsService.update(p.id, {
        name,
        category: this.editCategory(),
        description: this.editDescription().trim(),
        price,
        image_url: imageUrl,
        ingredients: this.editIngredients().trim(),
        nutritional_value: this.editNutritionalValue().trim(),
        extra_info: this.editExtraInfo().filter((i) => i.label.trim() || i.value.trim()),
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
  readonly addIcon = addOutline;
}
