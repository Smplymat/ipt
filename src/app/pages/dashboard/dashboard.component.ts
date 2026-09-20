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
import { LOW_STOCK_THRESHOLD, Product, ProductsService, toErrorMessage } from '../../services/products.service';
import { NewsletterService } from '../../services/newsletter.service';
import { ProductDetailModalComponent } from '../../components/product-detail-modal/product-detail-modal.component';

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
    ProductDetailModalComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly productsService = inject(ProductsService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastController);
  private readonly newsletter = inject(NewsletterService);

  readonly testimonials = TESTIMONIALS;

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly activeCategory = signal('All');
  readonly email = signal('');
  readonly subscribed = signal(false);

  /** Selected product to display in the detail modal (null = closed). */
  readonly selectedProduct = signal<Product | null>(null);

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

  handleSubscribe(): void {
    void this.subscribe(this.email().trim());
  }

  private async subscribe(email: string): Promise<void> {
    if (!email || !email.includes('@')) {
      const t = await this.toast.create({
        message: 'Please enter a valid email address.',
        duration: 2000,
        position: 'bottom',
      });
      await t.present();
      return;
    }
    try {
      const { alreadySubscribed } = await this.newsletter.subscribe(email);
      this.email.set('');
      const message = alreadySubscribed
        ? 'You are already on our list!'
        : 'Subscribed — welcome to the Knead to Know family!';
      this.subscribed.set(true);
      setTimeout(() => this.subscribed.set(false), 3000);
      const t = await this.toast.create({ message, duration: 2500, position: 'bottom' });
      await t.present();
    } catch {
      const t = await this.toast.create({
        message: 'Could not subscribe right now. Please try again later.',
        duration: 2500,
        position: 'bottom',
      });
      await t.present();
    }
  }

  /** True when the product has no sellable stock left. */
  isSoldOut(product: Product): boolean {
    return (Number(product.stock_quantity) || 0) === 0;
  }

  /** True when stock is low-but-available (for the "Only X left" hint). */
  isLowStock(product: Product): boolean {
    const s = Number(product.stock_quantity) || 0;
    return s > 0 && s <= LOW_STOCK_THRESHOLD;
  }

  openDetail(product: Product): void {
    this.selectedProduct.set(product);
  }

  closeDetail(): void {
    this.selectedProduct.set(null);
  }

  async addToCart(product: Product, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.isSoldOut(product)) return;
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