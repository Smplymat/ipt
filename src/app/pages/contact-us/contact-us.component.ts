import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonMenuButton,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { navigateOutline, timeOutline, callOutline, logoFacebook, logoInstagram, logoTiktok } from 'ionicons/icons';

const LOCATIONS = [
  {
    name: 'Quezon City Flagship',
    address: '123 Banawe St, Quezon City, Metro Manila 1104',
    hours: 'Mon–Sun · 7:00 AM – 8:00 PM',
    phone: '(02) 8712-3456',
    maps: 'https://maps.google.com/?q=123+Banawe+St+Quezon+City',
  },
  {
    name: 'Makati Branch',
    address: 'G/F Greenbelt 5, Ayala Center, Makati City 1224',
    hours: 'Mon–Sat · 8:00 AM – 9:00 PM · Sun · 9:00 AM – 7:00 PM',
    phone: '(02) 8845-6789',
    maps: 'https://maps.google.com/?q=Greenbelt+5+Ayala+Center+Makati',
  },
];

const CONTACT_INFO = [
  { icon: '📞', label: 'Customer Care', value: '(02) 8712-3456', detail: 'Mon–Fri 9 AM – 6 PM' },
  { icon: '📱', label: 'Viber / WhatsApp', value: '0917-123-4567', detail: 'Quick response for orders' },
  { icon: '✉️', label: 'Email', value: 'hello@kneadtoknow.ph', detail: 'Replies within 24 hours' },
  { icon: '📍', label: 'Head Office', value: '123 Banawe St, Quezon City', detail: 'Admin & production kitchen' },
];

@Component({
  selector: 'app-contact-us',
  imports: [
    FormsModule,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonMenuButton,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './contact-us.component.html',
})
export class ContactUsComponent {
  private readonly toast = inject(ToastController);

  readonly locations = LOCATIONS;
  readonly contactInfo = CONTACT_INFO;

  readonly form = {
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  };

  readonly submitting = signal(false);

  constructor() {
    addIcons({
      navigateOutline,
      timeOutline,
      callOutline,
      logoFacebook,
      logoInstagram,
      logoTiktok,
    });
  }

  async submit(): Promise<void> {
    if (!this.form.name.trim() || !this.form.email.trim() || !this.form.message.trim()) {
      const t = await this.toast.create({
        message: 'Please fill in all required fields.',
        duration: 2000,
        position: 'bottom',
        color: 'danger',
      });
      await t.present();
      return;
    }

    this.submitting.set(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1200));

    this.form.name = '';
    this.form.email = '';
    this.form.phone = '';
    this.form.subject = '';
    this.form.message = '';
    this.submitting.set(false);

    const t = await this.toast.create({
      message: 'Message sent! We\'ll get back to you within 24 hours.',
      duration: 3000,
      position: 'bottom',
      color: 'success',
    });
    await t.present();
  }

  openMap(url: string): void {
    window.open(url, '_blank');
  }
}