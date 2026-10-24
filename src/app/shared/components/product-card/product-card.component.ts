import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { Product } from '../../../services/products.service';
import { ChipComponent } from '../chip/chip.component';
import { StatusTagComponent } from '../status-tag/status-tag.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'ktk-product-card',
  standalone: true,
  imports: [CommonModule, IonIcon, ChipComponent, StatusTagComponent, ButtonComponent],
  template: `
    <article class="product-card" [class.sold-out]="soldOut()" (click)="onCardClick($event)" tabindex="0" role="listitem">
      <!-- Price tag -->
      <span class="price-tag">{{ formatPrice(product.price) }}</span>

      <!-- Category chip -->
      <ktk-chip variant="pastel" size="sm" [pastelColor]="pastelColor()" class="category-chip">
        {{ product.category }}
      </ktk-chip>

      <!-- Status badges -->
      @if (soldOut()) {
        <ktk-status-tag type="cancelled" label="Sold Out"></ktk-status-tag>
      } @else if (lowStock()) {
        <ktk-status-tag type="lowstock" label="Only {{ product.stock_quantity }} left"></ktk-status-tag>
      }

      <!-- Heart/Favorite button -->
      @if (showHeart) {
        <button
          type="button"
          class="heart-btn"
          [class.active]="isFavorite"
          (click)="onHeartClick($event)"
          [attr.aria-label]="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
          [attr.aria-pressed]="isFavorite">
          <ion-icon [name]="isFavorite ? 'heart' : 'heart-outline'" aria-hidden="true"></ion-icon>
        </button>
      }

      <!-- Details badge -->
      @if (hasDetails()) {
        <span class="details-badge">ℹ Details</span>
      }

      <!-- Image wrapper -->
      <div class="img-wrap" [style.background]="pastelColor()">
        @if (product.image_url) {
          <img [src]="product.image_url" [alt]="product.name" loading="lazy" (error)="onImageError($event)">
        } @else {
          <div class="img-fallback">
            <ion-icon name="restaurant-outline" aria-hidden="true"></ion-icon>
          </div>
        }
      </div>

      <!-- Card body -->
      <div class="card-body">
        <h3 class="product-name">{{ product.name }}</h3>

        <div class="rating" [attr.aria-label]="'Rating: ' + product.rating + ' out of 5'">
          @for (star of stars(); track $index) {
            <span class="star" [class.filled]="$index < roundedRating()">★</span>
          }
        </div>

        <p class="product-desc">{{ product.description }}</p>

        <div class="card-footer">
          <span class="price">{{ formatPrice(product.price) }}</span>
          <ktk-button
            variant="accent"
            size="sm"
            [disabled]="soldOut()"
            (onClick)="onAddToCart($event)">
            {{ soldOut() ? 'Sold Out' : 'Add to Cart' }}
          </ktk-button>
        </div>
      </div>
    </article>
  `,
  styles: [`
    .product-card {
      --background: var(--ktk-card-bg);
      border-radius: var(--ktk-radius-card) !important;
      box-shadow: var(--ktk-shadow-card) !important;
      border: 1px solid var(--ktk-card-border);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      transition: transform var(--ktk-dur-normal) var(--ktk-ease-out), box-shadow var(--ktk-dur-normal) var(--ktk-ease-out);

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--ktk-shadow-card-hover) !important;
      }

      &:focus-visible {
        outline: var(--ktk-focus-ring-width) solid var(--ktk-focus-ring-color);
        outline-offset: var(--ktk-focus-ring-offset);
      }

      &.sold-out {
        opacity: 0.7;
        pointer-events: none;

        .img-wrap img {
          filter: grayscale(1);
        }
      }

      /* Price tag */
      .price-tag {
        position: absolute;
        top: var(--ktk-space-3);
        right: var(--ktk-space-3);
        background: var(--ktk-accent);
        color: var(--ktk-text-on-accent);
        font-family: var(--ktk-font-serif);
        font-size: var(--ktk-fs-sm);
        font-weight: var(--ktk-fw-extrabold);
        padding: var(--ktk-space-1) var(--ktk-space-3);
        border-radius: var(--ktk-radius-button);
        z-index: 2;
        line-height: 1.4;
        white-space: nowrap;
      }

      /* Category chip */
      .category-chip {
        position: absolute;
        top: var(--ktk-space-3);
        left: var(--ktk-space-3);
        z-index: 2;
      }

      /* Status badges */
      ktk-status-tag {
        position: absolute;
        top: var(--ktk-space-3);
        right: var(--ktk-space-3);
        z-index: 2;
      }

      /* Heart button */
      .heart-btn {
        position: absolute;
        top: var(--ktk-space-3);
        right: var(--ktk-space-3);
        z-index: 2;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--ktk-card-bg);
        border: 1px solid var(--ktk-card-border);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: var(--ktk-shadow-sm);
        transition: all var(--ktk-dur-fast) var(--ktk-ease-out);

        &:hover {
          background: var(--ktk-accent);
          transform: scale(1.1);
        }

        &:active {
          transform: scale(0.95);
        }

        ion-icon {
          font-size: 1.125rem;
          color: var(--ktk-text-muted);
        }

        &.active ion-icon {
          color: var(--ktk-error);
        }
      }

      /* Details badge */
      .details-badge {
        position: absolute;
        bottom: var(--ktk-space-3);
        left: var(--ktk-space-3);
        z-index: 2;
        background: var(--ktk-card-bg);
        color: var(--ktk-text-secondary);
        font-family: var(--ktk-font-sans);
        font-size: var(--ktk-fs-xs);
        font-weight: var(--ktk-fw-medium);
        padding: var(--ktk-space-1) var(--ktk-space-2);
        border-radius: var(--ktk-radius-small);
        border: 1px solid var(--ktk-card-border);
        box-shadow: var(--ktk-shadow-sm);
      }

      /* Image wrapper */
      .img-wrap {
        aspect-ratio: 4 / 3;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--ktk-space-4) var(--ktk-space-3) var(--ktk-space-2);
        overflow: hidden;
        position: relative;

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--pastel-bg);
          opacity: 0.3;
          z-index: 0;
        }

        img {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: drop-shadow(0 4px 8px rgba(42, 26, 16, 0.15));
          transition: transform var(--ktk-dur-slow) var(--ktk-ease-out);
        }

        .product-card:hover & img {
          transform: scale(1.06);
        }

        .img-fallback {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: var(--ktk-card-bg);
          border-radius: var(--ktk-radius-tile);
          border: 2px dashed var(--ktk-card-border);

          ion-icon {
            font-size: 2.5rem;
            color: var(--ktk-text-muted);
          }
        }
      }

      /* Card body */
      .card-body {
        padding: var(--ktk-space-4) var(--ktk-space-4) var(--ktk-space-3);
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .product-name {
        font-family: var(--ktk-font-serif);
        font-size: var(--ktk-fs-lg);
        font-weight: var(--ktk-fw-bold);
        color: var(--ktk-text);
        margin: 0 0 var(--ktk-space-2);
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .rating {
        display: flex;
        gap: 2px;
        margin-bottom: var(--ktk-space-2);
        font-size: var(--ktk-fs-sm);
        color: var(--ktk-accent-text);
        letter-spacing: 1px;
        line-height: 1;

        .star {
          color: var(--ktk-card-border);
          transition: color var(--ktk-dur-fast);

          &.filled {
            color: var(--ktk-accent);
          }
        }
      }

      .product-desc {
        font-family: var(--ktk-font-sans);
        font-size: var(--ktk-fs-sm);
        color: var(--ktk-text-secondary);
        margin: 0 0 var(--ktk-space-3);
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        flex: 1 1 auto;
      }

      .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ktk-space-2);
        padding-top: var(--ktk-space-2);
        border-top: 1px solid var(--ktk-card-border);
      }

      .price {
        font-family: var(--ktk-font-serif);
        font-size: var(--ktk-fs-xl);
        font-weight: var(--ktk-fw-extrabold);
        color: var(--ktk-text);
        white-space: nowrap;
      }
    }
  `]
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Input() showHeart = true;
  @Input() isFavorite = false;
  @Input() pastelIndex = 0;

  @Output() addToCart = new EventEmitter<Event>();
  @Output() heartClick = new EventEmitter<Event>();
  @Output() cardClick = new EventEmitter<Event>();

  readonly pastelColors = [
    'var(--ktk-pastel-yellow)',
    'var(--ktk-pastel-bread)',
    'var(--ktk-pastel-pink)',
    'var(--ktk-pastel-cookie)',
    'var(--ktk-pastel-lavender)',
    'var(--ktk-pastel-green)',
  ];

  pastelColor = computed(() => this.pastelColors[this.pastelIndex % this.pastelColors.length]);
  pastelBg = computed(() => this.pastelColor() + '40'); // 25% opacity

  soldOut = computed(() => (Number(this.product.stock_quantity) || 0) === 0);
  lowStock = computed(() => {
    const s = Number(this.product.stock_quantity) || 0;
    return s > 0 && s <= 5;
  });

  hasDetails = computed(() =>
    !!(this.product.ingredients || this.product.nutritional_value || this.product.extra_info?.length)
  );

  stars = computed(() => Array(5).fill(0).map((_, i) => i));
  roundedRating = computed(() => Math.round(this.product.rating));

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  onCardClick(event: Event): void {
    // Don't trigger if clicking on interactive elements
    const target = event.target as HTMLElement;
    if (target.closest('button, a, ion-button, .heart-btn')) return;
    this.cardClick.emit(event);
  }

  onAddToCart(event: Event): void {
    event.stopPropagation();
    this.addToCart.emit(event);
  }

  onHeartClick(event: Event): void {
    event.stopPropagation();
    this.heartClick.emit(event);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}