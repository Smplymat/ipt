import { Component, computed, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-bread-catalog',
  imports: [
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

  readonly active = signal('All');

  /** Selected product to display in the detail modal (null = closed). */
  readonly selectedProduct = signal<Product | null>(null);

  /** Unique category list derived from catalog data. */
  readonly filters = computed(() => [
    'All',
    ...new Set(this.products().map((p) => p.category)),
  ]);

  /** Products visible under the active filter. */
  readonly visible = computed(() =>
    this.active() === 'All'
      ? this.products()
      : this.products().filter((p) => p.category === this.active())
  );

  /**
   * When "All" is selected, group visible products by category so the catalog
   * renders category headers + their items. When a specific category is active,
   * returns a single group so the template works uniformly.
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

  openDetail(product: Product): void {
    this.selectedProduct.set(product);
  }

  closeDetail(): void {
    this.selectedProduct.set(null);
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  stars(r: number): string {
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  }

  async addToCart(product: Product, event: Event): Promise<void> {
    // Prevent the card click (which opens the modal) from bubbling up.
    event.stopPropagation();
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
