import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { closeOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Product } from '../../services/products.service';

@Component({
  selector: 'app-product-detail-modal',
  imports: [IonIcon],
  templateUrl: './product-detail-modal.component.html',
})
export class ProductDetailModalComponent {
  @Input() product!: Product;
  @Output() dismiss = new EventEmitter<void>();

  readonly closeIcon = closeOutline;

  constructor() {
    addIcons({ closeOutline });
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  stars(r: number): string {
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  }
}
