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
import { Product, ProductsService, toErrorMessage, ExtraInfoItem, LOW_STOCK_THRESHOLD } from '../../services/products.service';
import { CategoriesService, Category } from '../../services/categories.service';
import {
  OrderWithItems,
  OrdersService,
  OrderStatus,
  PaymentMethod,
  STATUS_LABEL,
} from '../../services/orders.service';

type AdminTab = 'products' | 'categories' | 'users' | 'inventory' | 'orders' | 'sales';

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
  private readonly ordersService = inject(OrdersService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);

  readonly user = this.auth.user;
  readonly roleBadge = computed(() =>
    this.user()!.role === 'admin' ? 'Admin' : 'Store Admin'
  );

  /** Exposed for the Inventory template's low-stock badge labels. */
  readonly LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD;

  /** Number helper for the inventory template (templates can't call Number()). */
  stockNumber(p: Product): number {
    return Number(p.stock_quantity) || 0;
  }

  readonly tab = signal<AdminTab>('products');
  readonly canManageUsers = this.auth.isAdmin;

  /** Inventory tab filter: everything vs. only low/out-of-stock items. */
  readonly inventoryFilter = signal<'all' | 'low'>('all');
  readonly lowStockFlagShown = computed(() => this.inventoryFilter() === 'low');

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
  readonly createStock = signal('0');
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
  readonly editStock = signal('0');
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

  // ── Orders state (staff) ────────────────────────────────────────────────────

  readonly orders = signal<OrderWithItems[]>([]);
  readonly ordersLoading = signal(false);
  readonly ordersError = signal<string | null>(null);
  readonly statusSavingId = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);

  /** All valid statuses staff may set directly on an order. */
  readonly statuses: OrderStatus[] = [
    'pending',
    'preparing',
    'out_for_delivery',
    'ready_for_pickup',
    'delivered',
    'cancelled',
  ];

  // ── Sales state (staff) ─────────────────────────────────────────────────────

  /** Total revenue from non-cancelled orders. */
  readonly salesRevenue = computed(() =>
    this.orders()
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total), 0)
  );

  readonly salesDeliveredRevenue = computed(() =>
    this.orders()
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.total), 0)
  );

  readonly salesOrderCount = computed(() => this.orders().length);
  readonly salesActiveCount = computed(
    () => this.orders().filter((o) => o.status !== 'cancelled').length
  );

  /** Order count split by payment method. */
  readonly salesPaymentSplit = computed(() => {
    const list = this.orders();
    return {
      cod: list.filter((o) => o.payment_method === 'cod').length,
      online: list.filter((o) => o.payment_method === 'online').length,
    };
  });

  /** Best-selling products by total units, across non-cancelled orders. */
  readonly salesTopProducts = computed(() => {
    const counts = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of this.orders()) {
      if (o.status === 'cancelled') continue;
      for (const it of o.items) {
        const cur = counts.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += Number(it.price) * it.quantity;
        counts.set(it.name, cur);
      }
    }
    return [...counts.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  });

  /** Revenue per day over the last 7 calendar days (non-cancelled orders). */
  readonly salesLast7Days = computed(() => {
    const days: { label: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const revenue = this.orders()
        .filter(
          (o) =>
            o.status !== 'cancelled' &&
            new Date(o.created_at).getTime() >= d.getTime() &&
            new Date(o.created_at).getTime() < next.getTime()
        )
        .reduce((sum, o) => sum + Number(o.total), 0);
      days.push({ label: d.toLocaleDateString('en-PH', { weekday: 'short' }), revenue });
    }
    return days;
  });

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

  async loadOrders(): Promise<void> {
    this.ordersLoading.set(true);
    this.ordersError.set(null);
    try {
      this.orders.set(await this.ordersService.getOrders());
    } catch (err) {
      this.ordersError.set(toErrorMessage(err));
    } finally {
      this.ordersLoading.set(false);
    }
  }

  /** Sets an order's status directly (any state transition, staff only). */
  async setOrderStatus(order: OrderWithItems, status: OrderStatus): Promise<void> {
    if (status === order.status) return;
    this.statusSavingId.set(order.id);
    this.statusError.set(null);
    try {
      await this.ordersService.updateStatus(order.id, status);
      this.orders.update((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status } : o))
      );
    } catch (err) {
      this.statusError.set(`Could not update order #${this.shortOrderId(order)}: ${toErrorMessage(err)}`);
    } finally {
      this.statusSavingId.set(null);
    }
  }

  /** Increments (delta = +1/-1) the stock of a product from inventory. */
  async adjustStock(p: Product, delta: number): Promise<void> {
    const next = Math.max(0, (Number(p.stock_quantity) || 0) + delta);
    try {
      const updated = await this.productsService.update(p.id, { stock_quantity: next });
      this.products.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    }
  }

  /** Sets a product's stock to an explicit value from inventory. */
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

  /** Colored badge label for a product's current stock level. */
  stockBadge(p: Product): { label: string; color: string; bg: string } {
    const stock = Number(p.stock_quantity) || 0;
    if (stock <= 0) return { label: 'Out of stock', color: '#E04E2B', bg: 'rgba(255,91,53,0.12)' };
    if (stock <= LOW_STOCK_THRESHOLD) return { label: `Low stock · ${stock}`, color: '#B47A12', bg: 'rgba(245,166,35,0.16)' };
    return { label: `In stock · ${stock}`, color: '#2F7D46', bg: 'rgba(61,125,85,0.12)' };
  }

  /** Display name for a status as used on the admin Orders tab. */
  statusOptionLabel(status: OrderStatus): string {
    switch (status) {
      case 'out_for_delivery':
        return 'On Delivery';
      case 'delivered':
        return 'Finished';
      default:
        return STATUS_LABEL[status];
    }
  }

  /** Color for an order status chip on the admin Orders tab. */
  statusChipColor(status: OrderStatus): { fg: string; bg: string } {
    switch (status) {
      case 'pending':
        return { fg: '#C85A1F', bg: 'rgba(255,91,53,0.12)' };
      case 'preparing':
        return { fg: '#2F6FB3', bg: 'rgba(47,111,179,0.12)' };
      case 'out_for_delivery':
        return { fg: '#6B3A2A', bg: 'rgba(107,58,42,0.12)' };
      case 'ready_for_pickup':
        return { fg: '#0E7C7B', bg: 'rgba(23,162,184,0.12)' };
      case 'delivered':
        return { fg: '#2F7D46', bg: 'rgba(61,125,85,0.14)' };
      case 'cancelled':
        return { fg: '#8B6347', bg: 'rgba(196,168,130,0.25)' };
      default:
        return { fg: '#3D1E16', bg: 'rgba(196,168,130,0.2)' };
    }
  }

  shortOrderId(order: OrderWithItems): string {
    return order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  formatOrderDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  paymentLabel(p: PaymentMethod): string {
    return p === 'cod' ? 'Cash on Delivery' : 'Online Payment';
  }

  /** Bar height (px) for the daily revenue chart, clamped 4..120. */
  chartHeight(revenue: number): number {
    return Math.max(4, Math.min(120, Math.round(revenue / 200)));
  }

  // ── Category management ──────────────────────────────────────────────────────

  async handleCreateCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) return this.categoryFormError.set('Please enter a category name.');

    this.savingCategory.set(true);
    this.categoryFormError.set(null);
    try {
      // Timeout so a stalled request (offline, blocked fetch, CORS) surfaces
      // an error instead of leaving the button disabled with no feedback.
      const MAX_MS = 20_000;
      const cat = await this.withTimeout(
        this.categoriesService.create(name),
        MAX_MS,
        'Category request timed out. Check your connection and try again.'
      );
      if (!cat) throw new Error('The category was not saved. The database returned no row.');
      this.categories.update((list) => [...list, cat].sort((a, b) => a.name.localeCompare(b.name)));
      this.newCategoryName.set('');
    } catch (err) {
      console.error('Create category failed:', err);
      this.categoryFormError.set(toErrorMessage(err));
    } finally {
      this.savingCategory.set(false);
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]).finally(() => clearTimeout(timer));
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

  // ── Edit product ────────────────────────────────────────────────────────────

  startEdit(p: Product): void {
    this.editingId.set(p.id);
    this.editName.set(p.name);
    this.editCategory.set(p.category);
    this.editDescription.set(p.description);
    this.editPrice.set(String(p.price));
    this.editStock.set(String(Number(p.stock_quantity) || 0));
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
