import { Component, signal, computed } from '@angular/core';
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

// ─── Data ─────────────────────────────────────────────────────────────────────

const REVIEWS = [
  { id: 1, stars: 5, text: "Hands down the best sourdough I've ever had. The crust is perfectly crackling and the crumb is wonderfully airy. I order every single week!", author: 'Maria Santos', role: 'Loyal Customer · 12 orders', avatar: 'https://i.pravatar.cc/80?img=5', product: 'Classic Sourdough', date: 'Sep 10, 2026' },
  { id: 2, stars: 5, text: "The Choco Fudge Cake was the star of my daughter's birthday. Moist layers, rich ganache — everyone kept asking where it came from!", author: 'James Reyes', role: 'Happy Dad · 7 orders', avatar: 'https://i.pravatar.cc/80?img=12', product: 'Choco Fudge Cake', date: 'Sep 8, 2026' },
  { id: 3, stars: 4, text: 'Blueberry muffins are incredibly fresh. Packed with real blueberries and the tops have just the right amount of crunch. Will definitely reorder.', author: 'Leila Cruz', role: 'Regular Customer · 5 orders', avatar: 'https://i.pravatar.cc/80?img=9', product: 'Blueberry Muffins', date: 'Sep 5, 2026' },
  { id: 4, stars: 5, text: "The cinnamon rolls are unreal — pillowy soft with the perfect cream cheese glaze. Paired with coffee in the morning? Absolute heaven.", author: 'Ryan Ocampo', role: 'Coffee Enthusiast · 9 orders', avatar: 'https://i.pravatar.cc/80?img=33', product: 'Cinnamon Roll', date: 'Sep 2, 2026' },
];

const RATING_SUMMARY = [
  { stars: 5, count: 124 },
  { stars: 4, count: 38 },
  { stars: 3, count: 12 },
  { stars: 2, count: 3 },
  { stars: 1, count: 1 },
];

const TOTAL_REVIEWS = RATING_SUMMARY.reduce((s, r) => s + r.count, 0);
const AVG_RATING = (RATING_SUMMARY.reduce((s, r) => s + r.stars * r.count, 0) / TOTAL_REVIEWS).toFixed(1);

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
  readonly reviews = REVIEWS;
  readonly ratingSummary = RATING_SUMMARY;
  readonly totalReviews = TOTAL_REVIEWS;
  readonly avgRating = AVG_RATING;

  readonly hovered = signal(0);
  readonly selected = signal(0);
  readonly reviewText = signal('');
  readonly submitted = signal(false);

  readonly starLabel = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

  ratingPct(r: { stars: number; count: number }): number {
    return Math.round((r.count / TOTAL_REVIEWS) * 100);
  }

  starsString(stars: number): string {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  handleSubmit(): void {
    if (this.selected() === 0 || this.reviewText().trim() === '') return;
    this.submitted.set(true);
    setTimeout(() => {
      this.submitted.set(false);
      this.selected.set(0);
      this.reviewText.set('');
    }, 3000);
  }
}