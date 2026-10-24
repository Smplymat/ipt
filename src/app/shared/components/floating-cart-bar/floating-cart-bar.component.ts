import { Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon, IonButton, IonPopover } from '@ionic/angular';
import { CartService, CartLine } from '../../../services/cart.service';
import { addIcons } from 'ionicons';
import { cartOutline, removeOutline, addOutline, chevronForwardOutline, closeOutline, trashOutline } from 'ionicons/icons';

@Component({
  selector: 'ktk-floating-cart-bar',
  standalone: true,
  imports: [CommonModule, IonIcon, IonButton, IonPopover],
  template: `
    @if (showBar()) {
      <!-- Floating Cart Bar -->
      <div class="floating-cart-bar" [class.visible]="showBar()" role="region" aria-label="Shopping cart summary">
        <div class="bar-content">
          <div class="bar-info" (click)="goToCart()">
            <span class="bar-label">Cart</span>
            <span class="bar-count">{{ itemCount() }} item{{ itemCount() === 1 ? '' : 's' }}</span>
          </div>
          <span class="bar-total">{{ formatPrice(total()) }}</span>
        </div>

        <!-- CTA Buttons -->
        <div class="bar-actions">
          <ion-button
            fill="outline"
            size="small"
            (click)="goToCart()"
            class="view-cart-btn"
            aria-label="View full cart">
            View Cart
          </ion-button>
          <ion-button
            fill="solid"
            size="small"
            (click)="goToCheckout()"
            class="checkout-btn"
            [disabled]="itemCount() === 0"
            aria-label="Proceed to checkout">
            Checkout
          </ion-button>
        </div>
      </div>

      <!-- Popover Cart Panel -->
      <ion-popover
        [isOpen]="popoverOpen()"
        (ionPopoverDidPresent)="onPopoverDidPresent()"
        (ionPopoverDidDismiss)="onPopoverDidDismiss()"
        side="bottom"
        alignment="end"
        size="auto"
        showBackdrop="true"
        backdropDismiss="true"
        class="cart-popover">
        <ng-template>
          <div class="cart-popover-content">
            <header class="popover-header">
              <h3 class="popover-title">Your Cart</h3>
              <ion-button fill="clear" size="small" (click)="closePopover()" aria-label="Close cart">
                <ion-icon name="close-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </header>

            @if (lines().length === 0) {
              <div class="popover-empty">
                <ion-icon name="cart-outline" class="empty-icon" aria-hidden="true"></ion-icon>
                <h3 class="empty-heading">Your cart is empty</h3>
                <p class="empty-text">Looks like you haven't added any bakes yet.</p>
                <ion-button fill="solid" (click)="browseCatalog()" class="browse-btn">
                  Browse Catalog
                </ion-button>
              </div>
            } @else {
              <div class="popover-items">
                @for (line of lines(); track line.product.id) {
                  <div class="popover-item">
                    <div class="item-image-wrap">
                      @if (line.product.image_url) {
                        <img [src]="line.product.image_url" [alt]="line.product.name" class="item-image" loading="lazy">
                      } @else {
                        <div class="item-image-placeholder" aria-hidden="true">
                          <ion-icon name="restaurant-outline"></ion-icon>
                        </div>
                      }
                    </div>
                    <div class="item-info">
                      <p class="item-name">{{ line.product.name }}</p>
                      <p class="item-price">{{ formatPrice(line.product.price) }} each</p>
                    </div>
                    <div class="item-qty-controls">
                      <button class="qty-btn qty-btn--minus" (click)="decrement(line.product.id)" [disabled]="line.quantity <= 1" aria-label="Decrease quantity">
                        <ion-icon name="remove-outline" aria-hidden="true"></ion-icon>
                      </button>
                      <span class="qty-value" aria-live="polite">{{ line.quantity }}</span>
                      <button class="qty-btn qty-btn--plus" (click)="increment(line.product.id)" [disabled]="line.quantity >= maxQty(line.product)" aria-label="Increase quantity">
                        <ion-icon name="add-outline" aria-hidden="true"></ion-icon>
                      </button>
                    </div>
                    <button class="item-remove" (click)="remove(line.product.id)" aria-label="Remove {{ line.product.name }} from cart">
                      <ion-icon name="trash-outline" aria-hidden="true"></ion-icon>
                    </button>
                  </div>
                }
              </div>

              <footer class="popover-footer">
                <div class="totals">
                  <div class="total-row">
                    <span class="total-label">Subtotal ({{ itemCount() }} item{{ itemCount() === 1 ? '' : 's' }})</span>
                    <span class="total-value">{{ formatPrice(subtotal()) }}</span>
                  </div>
                  <div class="total-row">
                    <span class="total-label">Delivery</span>
                    <span class="total-value" [class.free]="deliveryFee() === 0">
                      {{ deliveryFee() === 0 ? 'FREE' : formatPrice(deliveryFee()) }}
                    </span>
                  </div>
                  <div class="total-row">
                    <span class="total-label">Tax (12%)</span>
                    <span class="total-value">{{ formatPrice(tax()) }}</span>
                  </div>
                  <div class="total-row grand-total">
                    <span class="total-label">Total</span>
                    <span class="total-value">{{ formatPrice(total()) }}</span>
                  </div>
                </div>

                <div class="popover-actions">
                  <ion-button fill="outline" expand="block" (click)="goToCart()" class="action-btn view-cart-btn">
                    View Cart
                  </ion-button>
                  <ion-button fill="solid" expand="block" (click)="goToCheckout()" class="action-btn checkout-btn" [disabled]="itemCount() === 0">
                    Checkout
                  </ion-button>
                </div>
              </footer>
            }
          </div>
        </ng-template>
      </ion-popover>
    }
  `,
  styles: [`
    .floating-cart-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: var(--ktk-floating-cart-height);
      background: var(--ktk-card-bg);
      border-top: 1px solid var(--ktk-card-border);
      box-shadow: 0 -4px 20px rgba(42, 26, 16, 0.15);
      z-index: var(--ktk-z-sticky);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--ktk-space-4);
      transform: translateY(100%);
      transition: transform var(--ktk-dur-normal) var(--ktk-ease-spring);

      &.visible {
        transform: translateY(0);
      }

      /* Hide on mobile when tab bar is visible */
      @media (max-width: 991.98px) {
        bottom: var(--ktk-tab-bar-height);
      }

      @media (min-width: 992px) {
        bottom: 0;
      }
    }

    .bar-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 1;
      cursor: pointer;
    }

    .bar-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .bar-label {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-xs);
      font-weight: var(--ktk-fw-semibold);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ktk-text-muted);
    }

    .bar-count {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-lg);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
    }

    .bar-total {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-xl);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-accent);
      white-space: nowrap;
    }

    .bar-actions {
      display: flex;
      gap: var(--ktk-space-2);
      margin-left: var(--ktk-space-4);
    }

    .view-cart-btn {
      --color: var(--ktk-primary);
      --border-color: var(--ktk-primary);
      --border-radius: var(--ktk-radius-button);
      font-weight: var(--ktk-fw-bold);
      font-size: var(--ktk-fs-sm);
      height: 36px;
    }

    .checkout-btn {
      --background: var(--ktk-accent);
      --color: var(--ktk-text-on-accent);
      --border-radius: var(--ktk-radius-button);
      font-weight: var(--ktk-fw-bold);
      font-size: var(--ktk-fs-sm);
      height: 36px;
      box-shadow: var(--ktk-shadow-fab);

      &:disabled {
        opacity: 0.5;
      }
    }

    /* Popover Styles */
    .cart-popover {
      --width: 360px;
      --max-width: 90vw;
      --max-height: 80vh;
    }

    .cart-popover-content {
      display: flex;
      flex-direction: column;
      min-width: 320px;
      max-width: 360px;
    }

    .popover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--ktk-space-3) var(--ktk-space-4);
      border-bottom: 1px solid var(--ktk-card-border);
    }

    .popover-title {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-lg);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
      margin: 0;
    }

    .popover-empty {
      text-align: center;
      padding: var(--ktk-space-8) var(--ktk-space-4);
    }

    .empty-icon {
      font-size: 3rem;
      color: var(--ktk-text-muted);
      margin-bottom: var(--ktk-space-3);
    }

    .empty-heading {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-lg);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
      margin: 0 0 var(--ktk-space-2);
    }

    .empty-text {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      color: var(--ktk-text-secondary);
      margin: 0 0 var(--ktk-space-4);
    }

    .browse-btn {
      --background: var(--ktk-accent);
      --color: var(--ktk-text-on-accent);
      --border-radius: var(--ktk-radius-button);
      font-weight: var(--ktk-fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .popover-items {
      padding: var(--ktk-space-2) 0;
      max-height: 40vh;
      overflow-y: auto;
    }

    .popover-item {
      display: flex;
      align-items: center;
      gap: var(--ktk-space-3);
      padding: var(--ktk-space-3) var(--ktk-space-4);
      border-bottom: 1px solid var(--ktk-card-border);
    }

    .item-image-wrap {
      width: 56px;
      height: 56px;
      border-radius: var(--ktk-radius-small);
      overflow: hidden;
      background: var(--ktk-base-tint);
      flex-shrink: 0;
    }

    .item-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .item-image-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ktk-text-muted);

      ion-icon { font-size: 1.5rem; }
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      font-weight: var(--ktk-fw-semibold);
      color: var(--ktk-text);
      margin: 0 0 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-price {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-xs);
      color: var(--ktk-text-secondary);
      margin: 0;
    }

    .item-qty-controls {
      display: flex;
      align-items: center;
      gap: var(--ktk-space-2);
    }

    .qty-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      cursor: pointer;
      transition: transform var(--ktk-dur-fast) var(--ktk-ease-out);

      &:active { transform: scale(0.9); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .qty-btn--minus {
      background: var(--ktk-muted-beige);
      color: var(--ktk-text);
    }

    .qty-btn--plus {
      background: var(--ktk-accent);
      color: var(--ktk-text-on-accent);
    }

    .qty-value {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-base);
      font-weight: var(--ktk-fw-extrabold);
      color: var(--ktk-text);
      min-width: 24px;
      text-align: center;
    }

    .item-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: var(--ktk-text-muted);
      cursor: pointer;
      transition: all var(--ktk-dur-fast);

      &:hover {
        background: var(--ktk-error-bg);
        color: var(--ktk-error);
      }

      ion-icon { font-size: 1.125rem; }
    }

    .popover-footer {
      padding: var(--ktk-space-3) var(--ktk-space-4);
      border-top: 1px solid var(--ktk-card-border);
      background: var(--ktk-base-tint);
    }

    .totals {
      margin-bottom: var(--ktk-space-3);
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: var(--ktk-space-1) 0;
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
    }

    .total-label {
      color: var(--ktk-text-secondary);
    }

    .total-value {
      font-weight: var(--ktk-fw-semibold);
      color: var(--ktk-text);
      white-space: nowrap;

      &.free {
        color: var(--ktk-success);
        font-weight: var(--ktk-fw-bold);
      }
    }

    .total-row.grand-total {
      border-top: 1px solid var(--ktk-card-border);
      padding-top: var(--ktk-space-2);
      margin-top: var(--ktk-space-1);

      .total-label,
      .total-value {
        font-size: var(--ktk-fs-base);
        font-weight: var(--ktk-fw-extrabold);
        font-family: var(--ktk-font-serif);
        color: var(--ktk-text);
      }
    }

    .popover-actions {
      display: flex;
      flex-direction: column;
      gap: var(--ktk-space-2);
    }

    .action-btn {
      --border-radius: var(--ktk-radius-button);
      font-weight: var(--ktk-fw-bold);
      font-size: var(--ktk-fs-sm);
      height: 44px;
    }

    .view-cart-btn {
      --color: var(--ktk-primary);
      --border-color: var(--ktk-primary);
    }

    .checkout-btn {
      --background: var(--ktk-accent);
      --color: var(--ktk-text-on-accent);
      box-shadow: var(--ktk-shadow-fab);
    }
  `]
})
export class FloatingCartBarComponent {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly lines = this.cart.lines;
  readonly itemCount = this.cart.itemCount;
  readonly subtotal = this.cart.subtotal;
  readonly deliveryFee = this.cart.deliveryFee;
  readonly tax = this.cart.tax;
  readonly total = this.cart.total;

  readonly popoverOpen = signal(false);
  readonly showBar = signal(false);

  constructor() {
    addIcons({
      'cart-outline': cartOutline,
      removeOutline,
      addOutline,
      chevronForwardOutline,
      closeOutline,
      trashOutline,
    });

    // Show bar when cart has items
    effect(() => {
      this.showBar.set(this.itemCount() > 0);
    });
  }

  onPopoverDidPresent(): void {
    this.popoverOpen.set(true);
  }

  onPopoverDidDismiss(): void {
    this.popoverOpen.set(false);
  }

  closePopover(): void {
    this.popoverOpen.set(false);
  }

  maxQty(product: any): number {
    return Math.max(0, Number(product.stock_quantity) || 0);
  }

  async increment(productId: string): Promise<void> {
    const line = this.lines().find(l => l.product.id === productId);
    if (!line) return;
    const max = this.maxQty(line.product);
    if (line.quantity >= max) return;
    await this.cart.setQuantity(productId, line.quantity + 1);
  }

  async decrement(productId: string): Promise<void> {
    const line = this.lines().find(l => l.product.id === productId);
    if (!line) return;
    await this.cart.setQuantity(productId, line.quantity - 1);
  }

  async remove(productId: string): Promise<void> {
    await this.cart.removeFromCart(productId);
  }

  goToCart(): void {
    this.closePopover();
    this.router.navigate(['/orders'], { fragment: 'cart' });
  }

  async goToCheckout(): Promise<void> {
    if (this.itemCount() === 0) return;
    this.closePopover();
    this.router.navigate(['/checkout']);
  }

  browseCatalog(): void {
    this.closePopover();
    this.router.navigate(['/bread-catalog']);
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }
}