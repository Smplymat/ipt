import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonRow,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { CartService } from '../../services/cart.service';
import { Product, ProductsService, toErrorMessage } from '../../services/products.service';

const TESTIMONIALS = [
  { id: 1, text: 'Every single bite feels like a warm hug. The sourdough is unbelievably good — I order every week!', author: 'Maria Santos', role: 'Loyal Customer', avatar: 'https://i.pravatar.cc/80?img=5' },
  { id: 2, text: "The Choco Fudge Cake was the star of my daughter's birthday. Everyone kept asking where it came from!", author: 'James Reyes', role: 'Happy Dad', avatar: 'https://i.pravatar.cc/80?img=12' },
];

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonCard,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonInput,
    IonMenuButton,
    IonRow,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly productsService = inject(ProductsService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastController);

  readonly testimonials = TESTIMONIALS;

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly activeCategory = signal('All');
  readonly email = signal('');

  /** Category pills derived from the real catalog. */
  readonly categories = computed(() => [
    'All',
    ...new Set(this.products().map((p) => p.category)),
  ]);

  /** "Service" circles derived from each category + the first matching image. */
  readonly categoryCircles = computed(() =>
    this.categories()
      .filter((c) => c !== 'All')
      .map((category) => ({
        label: category.toUpperCase(),
        img: this.products().find((p) => p.category === category)?.image_url ?? '',
      }))
  );

  readonly visibleProducts = computed(() =>
    this.activeCategory() === 'All'
      ? this.products()
      : this.products().filter((p) => p.category === this.activeCategory())
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

  async addToCart(product: Product): Promise<void> {
    this.cart.add(product);
    const toast = await this.toast.create({
      message: `${product.name} added to cart 🛒`,
      duration: 1800,
      position: 'bottom',
      color: 'dark',
    });
    await toast.present();
  }
}