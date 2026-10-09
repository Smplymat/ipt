import { Component } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

const CATEGORIES = [
  {
    name: 'Artisan Breads',
    description: 'Slow-fermented, naturally leavened loaves with deep flavor and open crumb. Our sourdough uses a 12-year-old starter.',
    image: 'https://images.unsplash.com/photo-1585478259715-4d1661910e7b?w=400&h=300&fit=crop&auto=format',
    highlights: ['No commercial yeast', '18+ hour fermentation', 'Stone-baked crust'],
  },
  {
    name: 'Viennoiserie & Pastries',
    description: 'Buttery, laminated doughs made with French AOP butter. Croissants, pain au chocolat, and Danish pastries baked fresh daily.',
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=300&fit=crop&auto=format',
    highlights: ['AOP butter', 'Hand-laminated', 'Baked to order'],
  },
  {
    name: 'Celebration Cakes',
    description: 'Custom-designed cakes for every milestone. From elegant wedding tiers to playful birthday creations — all made from scratch.',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop&auto=format',
    highlights: ['Custom designs', 'Real buttercream', 'Fresh fruit fillings'],
  },
  {
    name: 'Cookies & Small Bites',
    description: 'Chunky, chewy, or crisp — our cookies pack maximum flavor. Double chocolate, oatmeal raisin, and seasonal specials.',
    image: 'https://images.unsplash.com/photo-1499636138777-b2b6e3b9f7c6?w=400&h=300&fit=crop&auto=format',
    highlights: ['Premium chocolate', 'Baked daily', 'Gift-ready packaging'],
  },
  {
    name: 'Muffins & Quick Breads',
    description: 'Tender, moist, and generously studded with real fruit, nuts, or chocolate. Perfect for breakfast or afternoon tea.',
    image: 'https://images.unsplash.com/photo-1517433456452-f9633a875f6f?w=400&h=300&fit=crop&auto=format',
    highlights: ['Real fruit, no jam', 'Whole grain options', 'Warm from the oven'],
  },
  {
    name: 'Seasonal Specials',
    description: 'Limited-edition creations that celebrate the flavors of the season — mango in summer, pumpkin in fall, ube year-round.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop&auto=format',
    highlights: ['Rotating monthly', 'Local produce', 'Small batches'],
  },
];

const INGREDIENT_PHILOSOPHY = [
  { icon: '🌾', title: 'Heritage Grains', detail: 'We work with local millers to source heirloom wheat varieties — higher nutrition, richer flavor.' },
  { icon: '🧈', title: 'French AOP Butter', detail: 'Our croissants use Isigny Sainte-Mère AOP butter — 82% butterfat for unmatched flakiness.' },
  { icon: '🍓', title: 'Farm-Fresh Produce', detail: 'Strawberries from La Trinidad, mangoes from Guimaras — picked at peak ripeness.' },
  { icon: '🥚', title: 'Free-Range Eggs', detail: 'From happy hens in Bulacan. Richer yolks mean better color and structure in every bake.' },
  { icon: '🍫', title: 'Single-Origin Chocolate', detail: 'Davao and Bohol cacao, processed bean-to-bar by local chocolatiers.' },
  { icon: '🥛', title: 'Fresh Dairy Daily', detail: 'Milk and cream delivered each morning from a family dairy in Rizal.' },
];

@Component({
  selector: 'app-about-products',
  imports: [
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './about-products.component.html',
})
export class AboutProductsComponent {
  readonly categories = CATEGORIES;
  readonly ingredients = INGREDIENT_PHILOSOPHY;
}