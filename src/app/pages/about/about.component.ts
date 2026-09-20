import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonMenuButton,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '12+', label: 'Years Baking' },
  { value: '4.8★', label: 'Avg. Rating' },
  { value: '2,400+', label: 'Happy Customers' },
  { value: '50+', label: 'Menu Items' },
];

const VALUES = [
  { emoji: '', title: 'Local Ingredients', body: 'We source every grain, berry, and egg from farms within 50 km of our bakery — fresher produce means better flavour.' },
  { emoji: '', title: 'Handcrafted Daily', body: 'Nothing is frozen or pre-made. Our bakers arrive before dawn so your order is warm and fresh every single morning.' },
  { emoji: '', title: 'Zero Waste Goal', body: "Unsold day-old loaves are donated to local shelters. We're committed to making sure great food never goes to waste." },
  { emoji: '', title: 'Community First', body: 'From school fundraisers to wedding cakes, we show up for the moments that matter most to our neighbours.' },
];

const MILESTONES = [
  { year: '2012', event: 'Opened our first small bakery in Quezon City with just 3 products.' },
  { year: '2016', event: 'Expanded to a full production kitchen and added custom cake orders.' },
  { year: '2020', event: 'Launched online ordering to serve customers safely during the pandemic.' },
  { year: '2024', event: 'Reached 2,000 loyal customers and introduced the Knead to Know app.' },
  { year: '2026', event: 'Rolled out city-wide delivery and a brand-new loyalty rewards program.' },
];

@Component({
  selector: 'app-about',
  imports: [
    RouterLink,
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonMenuButton,
    IonRow,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './about.component.html',
})
export class AboutComponent {
  readonly stats = STATS;
  readonly values = VALUES;
  readonly milestones = MILESTONES;
}