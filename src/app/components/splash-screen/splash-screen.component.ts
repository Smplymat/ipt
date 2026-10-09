import { Component, effect, inject, signal } from '@angular/core';
import { IonSpinner } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [IonSpinner],
  template: `
    @if (show()) {
      <div class="splash-overlay" [class.fade-out]="fadeOut()">
        <div class="splash-content">
          <img src="/logo.jpg" alt="Knead to Know" class="splash-logo" (error)="onImageError($event)" />
          <p class="splash-name">Knead to Know</p>
          <p class="splash-tagline">Artisan Bakery</p>
          <ion-spinner name="crescent" color="primary" class="splash-spinner"></ion-spinner>
        </div>
      </div>
    }
  `,
  styles: [`
    .splash-overlay {
      position: fixed;
      inset: 0;
      background: var(--bakery-base);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.4s ease-out, visibility 0.4s ease-out;
    }

    .splash-overlay.fade-out {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .splash-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }

    .splash-logo {
      width: 120px;
      height: 120px;
      border-radius: 24px;
      object-fit: cover;
      box-shadow: 0 8px 32px rgba(77, 42, 0, 0.2);
      border: 3px solid var(--bakery-dark);
    }

    .splash-name {
      font-family: 'Georgia', serif;
      font-size: 2rem;
      font-weight: 700;
      color: var(--bakery-dark);
      margin: 0;
      letter-spacing: 1px;
    }

    .splash-tagline {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--bakery-burnt);
      margin: 0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .splash-spinner {
      --size: 40px;
      margin-top: 8px;
    }

    @media (prefers-reduced-motion: reduce) {
      .splash-overlay {
        transition: none;
      }
    }
  `],
})
export class SplashScreenComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly show = signal(true);
  readonly fadeOut = signal(false);

  constructor() {
    // Show splash for 2.5 seconds, then fade out
    const timer = setTimeout(() => {
      this.fadeOut.set(true);
      setTimeout(() => {
        this.show.set(false);
      }, 400);
    }, 2500);

    // If auth is ready and user is logged in, we can proceed
    // Otherwise splash will just time out
    effect(() => {
      if (this.auth.ready() && !this.auth.user()) {
        // User not logged in - splash will still show for full duration
        // to maintain consistent branding experience
      }
    });

    // Cleanup on destroy
    // Note: In a real app, you'd use ngOnDestroy, but for this simple
    // component the timer will be cleaned up when the component is removed
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}