import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonMenuButton,
  IonRow,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { CartService } from '../../services/cart.service';
import { Product, ProductsService, toErrorMessage } from '../../services/products.service';
import { ProductDetailModalComponent } from '../../components/product-detail-modal/product-detail-modal.component';

export type SortKey = 'default' | 'price_asc' | 'price_desc' | 'rating_desc';

@Component({
  selector: 'app-bread-catalog',
  imports: [
    FormsModule,
    RouterLink,
    IonButton,
    IonCard,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonMenuButton,
    IonRow,
    IonTitle,
    IonToolbar,
    ProductDetailModalComponent,
  ],
  templateUrl: './bread-catalog.component.html',
})
export class BreadCatalogComponent {
  private readonly productsService = inject(ProductsService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastController);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // ── Filter / Search / Sort state ──────────────────────────────────────────

  /** Active category pill. */
  readonly active = signal('All');

  /** Free-text search query (name or description). */
  readonly searchQuery = signal('');

  /** Price range filter. */
  readonly priceMin = signal<number | null>(null);
  readonly priceMax = signal<number | null>(null);

  /** Sort key. */
  readonly sortKey = signal<SortKey>('default');

  /** Whether the filter panel is expanded. */
  readonly filtersOpen = signal(false);

  /** Selected product to display in the detail modal (null = closed). */
  readonly selectedProduct = signal<Product | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  /** Unique category list derived from catalog data. */
  readonly filters = computed(() => [
    'All',
    ...new Set(this.products().map((p) => p.category)),
  ]);

  /** Max price across all products (drives the price slider upper bound). */
  readonly maxProductPrice = computed(() =>
    this.products().reduce((m, p) => Math.max(m, p.price), 0)
  );

  /** Whether any filter beyond category is active (badge indicator). */
  readonly hasActiveFilters = computed(() =>
    this.searchQuery().trim().length > 0 ||
    this.priceMin() !== null ||
    this.priceMax() !== null ||
    this.sortKey() !== 'default'
  );

  /** Products after applying category, search, price range, and sort. */
  readonly visible = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const min = this.priceMin();
    const max = this.priceMax();
    const cat = this.active();

    let list = this.products();

    // 1. Category filter
    if (cat !== 'All') list = list.filter((p) => p.category === cat);

    // 2. Text search (name + description)
    if (q.length > 0) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    // 3. Price range
    if (min !== null) list = list.filter((p) => p.price >= min);
    if (max !== null) list = list.filter((p) => p.price <= max);

    // 4. Sort
    const key = this.sortKey();
    if (key === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (key === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (key === 'rating_desc') list = [...list].sort((a, b) => b.rating - a.rating);
    // 'default' keeps DB order (created_at DESC)

    return list;
  });

  /**
   * Groups visible products by category when "All" is selected; otherwise
   * returns a single group — the template works uniformly either way.
   */
  readonly groupedProducts = computed((): { category: string; items: Product[] }[] => {
    const list = this.visible();
    if (this.active() !== 'All') {
      return list.length ? [{ category: this.active(), items: list }] : [];
    }
    const map = new Map<string, Product[]>();
    for (const p of list) {
      const bucket = map.get(p.category) ?? [];
      bucket.push(p);
      map.set(p.category, bucket);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  });

  constructor() {
    void this.loadProducts();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.products.set(await this.productsService.list());
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Filter helpers ────────────────────────────────────────────────────────

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.priceMin.set(null);
    this.priceMax.set(null);
    this.sortKey.set('default');
    this.active.set('All');
  }

  setPriceMin(value: string): void {
    const n = parseFloat(value);
    this.priceMin.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  setPriceMax(value: string): void {
    const n = parseFloat(value);
    this.priceMax.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  openDetail(product: Product): void {
    this.selectedProduct.set(product);
  }

  closeDetail(): void {
    this.selectedProduct.set(null);
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  stars(r: number): string {
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  }

  // ── Cart ──────────────────────────────────────────────────────────────────

  async addToCart(product: Product, event: Event): Promise<void> {
    event.stopPropagation(); // don't open the detail modal
    this.cart.add(product);
    const t = await this.toast.create({
      message: `${product.name} added to cart 🛒`,
      duration: 1800,
      position: 'bottom',
      color: 'dark',
    });
    await t.present();
  }
}
