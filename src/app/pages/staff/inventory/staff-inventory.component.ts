import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { LOW_STOCK_THRESHOLD, Product, ProductsService, toErrorMessage } from '../../../services/products.service';

import {
  ProductCardComponent,
  ChipComponent,
  SegmentedTabsComponent,
  PageHeaderComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  ButtonComponent,
} from '../../../shared';

import { addIcons } from 'ionicons';
import { searchOutline, optionsOutline, warningOutline } from 'ionicons/icons';

export type SortKey = 'default' | 'price_asc' | 'price_desc' | 'rating_desc';

@Component({
  selector: 'app-staff-inventory',
  imports: [
    IonContent,
    IonIcon,
    ProductCardComponent,
    ChipComponent,
    SegmentedTabsComponent,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonComponent,
  ],
  templateUrl: './staff-inventory.component.html',
  styleUrl: './staff-inventory.component.scss',
})
export class StaffInventoryComponent {
  private readonly productsService = inject(ProductsService);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly active = signal('All');
  readonly searchQuery = signal('');
  readonly priceMin = signal<number | null>(null);
  readonly priceMax = signal<number | null>(null);
  readonly sortKey = signal<'default' | 'price_asc' | 'price_desc' | 'rating_desc'>('default');
  readonly filtersOpen = signal(false);

  readonly filters = computed(() => [
    'All',
    ...new Set(this.products().map((p) => p.category)),
  ]);

  readonly maxProductPrice = computed(() =>
    this.products().reduce((m, p) => Math.max(m, p.price), 0)
  );

  readonly hasActiveFilters = computed(() =>
    this.searchQuery().trim().length > 0 ||
    this.priceMin() !== null ||
    this.priceMax() !== null ||
    this.sortKey() !== 'default'
  );

  readonly visible = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const min = this.priceMin();
    const max = this.priceMax();
    const cat = this.active();

    let list = this.products();

    if (cat !== 'All') list = list.filter((p) => p.category === cat);
    if (q.length > 0) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    if (min !== null) list = list.filter((p) => p.price >= min);
    if (max !== null) list = list.filter((p) => p.price <= max);

    const key = this.sortKey();
    if (key === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (key === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (key === 'rating_desc') list = [...list].sort((a, b) => b.rating - a.rating);

    return list;
  });

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

  readonly lowStockCount = computed(() =>
    this.products().filter((p) => this.isLowStock(p)).length
  );

  constructor() {
    addIcons({ 'search-outline': searchOutline, 'options-outline': optionsOutline, 'warning-outline': warningOutline });
    void this.loadProducts();
  }

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

  onSortChange(value: string): void {
    this.sortKey.set(value as 'default' | 'price_asc' | 'price_desc' | 'rating_desc');
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  stars(r: number): string {
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  }

  isSoldOut(product: Product): boolean {
    return (Number(product.stock_quantity) || 0) === 0;
  }

  isLowStock(product: Product): boolean {
    const s = Number(product.stock_quantity) || 0;
    return s > 0 && s <= 5;
  }

  stockBadge(p: Product): { label: string; color: string; bg: string } {
    const stock = Number(p.stock_quantity) || 0;
    if (stock <= 0) return { label: 'Out of stock', color: '#C0392B', bg: 'rgba(192,57,43,0.12)' };
    if (stock <= 5) return { label: `Low stock · ${stock}`, color: '#F2A900', bg: 'rgba(242,169,0,0.16)' };
    return { label: `In stock · ${stock}`, color: '#2E7D4F', bg: 'rgba(46,125,79,0.12)' };
  }

  openDetail(product: Product): void {
    // Navigate to product detail or open modal - for now just log
    console.log('Open detail for', product.name);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'logo.jpg';
    img.alt = 'Product image unavailable';
  }
}