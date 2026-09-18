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

  /** Filters derived from the real catalog data. */
  readonly filters = computed(() => [
    'All',
    ...new Set(this.products().map((p) => p.category)),
  ]);

  readonly visible = computed(() =>
    this.active() === 'All'
      ? this.products()
      : this.products().filter((p) => p.category === this.active())
  );

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

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  stars(r: number): string {
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  }

  async addToCart(product: Product): Promise<void> {
    this.cart.add(product);
    const toast = await this.toast.create({
      message: `${product.name} added to cart 🛒`,
      duration: 1800,
      position: 'bottom',
      color: 'dark',
      buttons: [{ text: 'View', handler: () => undefined }],
    });
    await toast.present();
  }
}