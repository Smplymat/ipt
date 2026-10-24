import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon, ToastController } from '@ionic/angular';
import { LOW_STOCK_THRESHOLD, Product, ProductsService, toErrorMessage, ExtraInfoItem } from '../../../services/products.service';
import { CategoriesService, Category } from '../../../services/categories.service';

import {
  ButtonComponent,
  FormFieldComponent,
  PageHeaderComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  TicketCardComponent,
} from '../../../shared';

import { addIcons } from 'ionicons';
import { closeOutline, createOutline, imageOutline, trashOutline, addOutline, searchOutline, optionsOutline } from 'ionicons/icons';

type StaffProductsTab = 'products' | 'categories';

@Component({
  selector: 'app-staff-products',
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    ButtonComponent,
    FormFieldComponent,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TicketCardComponent,
  ],
  templateUrl: './staff-products.component.html',
  styleUrl: './staff-products.component.scss',
})
export class StaffProductsComponent {
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly toast = inject(ToastController);

  readonly tab = signal<StaffProductsTab>('products');
  readonly canManageProducts = true;

  readonly LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD;

  readonly products = signal<Product[]>([]);
  readonly productsLoading = signal(true);
  readonly productsError = signal<string | null>(null);

  readonly categories = signal<Category[]>([]);
  readonly categoriesLoading = signal(false);
  readonly categoriesError = signal<string | null>(null);
  readonly newCategoryName = signal('');
  readonly savingCategory = signal(false);
  readonly categoryFormError = signal<string | null>(null);

  readonly categoryNames = computed(() =>
    this.categories().length > 0
      ? this.categories().map((c) => c.name)
      : ['Breads', 'Pastries', 'Cakes', 'Cookies', 'Muffins', 'Seasonal']
  );

  readonly createName = signal('');
  readonly createCategory = signal('Breads');
  readonly createDescription = signal('');
  readonly createPrice = signal('');
  readonly createStock = signal('0');
  readonly createIngredients = signal('');
  readonly createNutritionalValue = signal('');
  readonly createExtraInfo = signal<ExtraInfoItem[]>([]);
  readonly createImageFile = signal<File | null>(null);
  readonly createImagePreview = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editCategory = signal('');
  readonly editDescription = signal('');
  readonly editPrice = signal('');
  readonly editStock = signal('0');
  readonly editIngredients = signal('');
  readonly editNutritionalValue = signal('');
  readonly editExtraInfo = signal<ExtraInfoItem[]>([]);
  readonly editImageFile = signal<File | null>(null);
  readonly editImagePreview = signal<string | null>(null);
  readonly savingEdit = signal(false);

  readonly closeOutline = closeOutline;
  readonly createOutline = createOutline;
  readonly imageOutline = imageOutline;
  readonly trashOutline = trashOutline;
  readonly addOutline = addOutline;
  readonly searchOutline = searchOutline;
  readonly optionsOutline = optionsOutline;

  constructor() {
    addIcons({
      closeOutline,
      createOutline,
      imageOutline,
      trashOutline,
      addOutline,
      searchOutline,
      optionsOutline,
    });
    void this.loadProducts();
    void this.loadCategories();
  }

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
      if (!this.categoryNames().includes(this.createCategory())) {
        this.createCategory.set(this.categoryNames()[0] ?? 'Breads');
      }
    } catch (err) {
      this.categoriesError.set(toErrorMessage(err));
    } finally {
      this.categoriesLoading.set(false);
    }
  }

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
    const alert = confirm(`Delete "${cat.name}"? Products assigned to this category will keep the name but it will no longer appear in the dropdown.`);
    if (!alert) return;
    try {
      await this.categoriesService.remove(cat.id);
      this.categories.update((list) => list.filter((c) => c.id !== cat.id));
    } catch (err) {
      this.categoryFormError.set(toErrorMessage(err));
    }
  }

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

  stockNumber(p: Product): number {
    return Number(p.stock_quantity) || 0;
  }

  stockBadge(p: Product): { label: string; color: string; bg: string } {
    const stock = Number(p.stock_quantity) || 0;
    if (stock <= 0) return { label: 'Out of stock', color: '#C0392B', bg: 'rgba(192,57,43,0.12)' };
    if (stock <= LOW_STOCK_THRESHOLD) return { label: `Low stock · ${stock}`, color: '#F2A900', bg: 'rgba(242,169,0,0.16)' };
    return { label: `In stock · ${stock}`, color: '#2E7D4F', bg: 'rgba(46,125,79,0.12)' };
  }

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
    this.createStock.set('0');
    this.createIngredients.set('');
    this.createNutritionalValue.set('');
    this.createExtraInfo.set([]);
    this.createImageFile.set(null);
    this.createImagePreview.set(null);
  }

  async handleCreate(): Promise<void> {
    const name = this.createName().trim();
    const price = Number(this.createPrice());
    const stock = Number(this.createStock());
    if (!name) return this.formError.set('Please enter a product name.');
    if (this.createPrice() === '' || isNaN(price) || price < 0)
      return this.formError.set('Please enter a valid price.');
    if (this.createStock() === '' || isNaN(stock) || stock < 0 || !Number.isInteger(stock))
      return this.formError.set('Please enter a valid stock quantity (a whole number of items).');
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
        stock_quantity: stock,
      });
      this.products.update((list) => [product, ...list]);
      this.resetCreateForm();
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  startEdit(p: Product): void {
    this.editingId.set(p.id);
    this.editName.set(p.name);
    this.editCategory.set(p.category);
    this.editDescription.set(p.description);
    this.editPrice.set(String(p.price));
    this.editStock.set(String(Number(p.stock_quantity) || 0));
    this.editIngredients.set(p.ingredients ?? '');
    this.editNutritionalValue.set(p.nutritional_value ?? '');
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
    const stock = Number(this.editStock());
    if (!name) return this.formError.set('Please enter a product name.');
    if (this.editPrice() === '' || isNaN(price) || price < 0)
      return this.formError.set('Please enter a valid price.');
    if (this.editStock() === '' || isNaN(stock) || stock < 0 || !Number.isInteger(stock))
      return this.formError.set('Please enter a valid stock quantity (a whole number of items).');

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
        stock_quantity: stock,
      });
      this.products.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      this.cancelEdit();
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    } finally {
      this.savingEdit.set(false);
    }
  }

  async confirmDelete(p: Product): Promise<void> {
    const alert = confirm(`Delete "${p.name}"? The product record and its image will be permanently removed.`);
    if (!alert) return;
    try {
      await this.productsService.remove(p.id);
      await this.productsService.deleteImageByUrl(p.image_url).catch(() => undefined);
      this.products.update((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    }
  }

  async adjustStock(p: Product, delta: number): Promise<void> {
    const next = Math.max(0, (Number(p.stock_quantity) || 0) + delta);
    try {
      const updated = await this.productsService.update(p.id, { stock_quantity: next });
      this.products.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    }
  }

  async setStockQuantity(p: Product, event: Event): Promise<void> {
    const raw = (event.target as HTMLInputElement).value;
    const n = Math.max(0, Math.round(Number(raw)));
    if (isNaN(n)) return;
    try {
      const updated = await this.productsService.update(p.id, { stock_quantity: n });
      this.products.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    }
  }

  handleTicketAction(action: any, p: Product): void {
    const act = action as string;
    switch (act) {
      case 'edit':
        this.startEdit(p);
        break;
      case 'delete':
        this.confirmDelete(p);
        break;
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary'): Promise<void> {
    const toast = await this.toast.create({ message, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}