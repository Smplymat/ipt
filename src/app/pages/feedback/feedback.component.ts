import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonMenuButton,
  IonRow,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { toErrorMessage } from '../../services/orders.service';
import { Product, ProductsService } from '../../services/products.service';
import { ReviewWithProduct, ReviewsService } from '../../services/reviews.service';

@Component({
  selector: 'app-feedback',
  imports: [
    CommonModule,
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonMenuButton,
    IonRow,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './feedback.component.html',
})
export class FeedbackComponent {
  private readonly reviewsService = inject(ReviewsService);
  private readonly productsService = inject(ProductsService);
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;

  readonly products = signal<Product[]>([]);
  readonly reviews = signal<ReviewWithProduct[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // Write form
  readonly productId = signal('');
  readonly hovered = signal(0);
  readonly selected = signal(0);
  readonly comment = signal('');
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formMessage = signal<string | null>(null);

  readonly starLabel = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

  readonly totalReviews = computed(() => this.reviews().length);
  readonly avgRating = computed(() =>
    this.totalReviews() > 0
      ? this.reviews().reduce((s, r) => s + r.rating, 0) / this.totalReviews()
      : 0
  );
  readonly ratingSummary = computed(() =>
    [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: this.reviews().filter((r) => r.rating === stars).length,
    }))
  );

  readonly selectedProductLabel = computed(
    () => this.products().find((p) => p.id === this.productId())?.name ?? ''
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [products, reviews] = await Promise.all([
        this.productsService.list(),
        this.reviewsService.list(),
      ]);
      this.products.set(products);
      this.reviews.set(reviews);
      if (!this.productId() && products.length > 0) this.productId.set(products[0].id);
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  ratingPct(r: { stars: number; count: number }): number {
    return this.totalReviews() > 0 ? Math.round((r.count / this.totalReviews()) * 100) : 0;
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  starsString(stars: number): string {
    return '★'.repeat(Math.round(stars)) + '☆'.repeat(5 - Math.round(stars));
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async handleSubmit(): Promise<void> {
    if (this.submitting()) return;
    if (!this.user()) return this.formError.set('Please sign in to leave a review.');
    if (!this.productId()) return this.formError.set('Choose a product to review.');
    if (this.selected() < 1 || this.selected() > 5)
      return this.formError.set('Pick a star rating (1–5).');
    if (this.comment().trim().length < 5)
      return this.formError.set('Tell us a bit more about your order (at least 5 characters).');

    this.submitting.set(true);
    this.formError.set(null);
    this.formMessage.set(null);
    try {
      await this.reviewsService.save(this.productId(), this.selected(), this.comment().trim());
      this.formMessage.set('Thanks for the review — it is now live on this page!');
      this.comment.set('');
      this.selected.set(0);
      await this.load();
    } catch (err) {
      this.formError.set(toErrorMessage(err));
    } finally {
      this.submitting.set(false);
    }
  }
}