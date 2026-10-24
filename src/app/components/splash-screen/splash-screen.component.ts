import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [],
  template: `
    @if (show()) {
      <div class="ktk-splash" [class.fade-out]="fadeOut()">
        <div class="ktk-splash-content">
          <div class="ktk-splash-logo-wrap">
            <img src="/logo.jpg" alt="Knead to Know" class="ktk-splash-logo" (error)="onImageError($event)" />
          </div>
          <h1 class="ktk-splash-name">Knead to Know</h1>
          <p class="ktk-splash-tagline">Baked fresh, picked up warm</p>
          <div class="ktk-splash-spinner"></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .ktk-splash {
      position: fixed;
      inset: 0;
      background: var(--ktk-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.4s var(--ktk-ease-out), visibility 0.4s var(--ktk-ease-out);
    }

    .ktk-splash.fade-out {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .ktk-splash-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ktk-space-4);
      text-align: center;
    }

    .ktk-splash-logo-wrap {
      width: 140px;
      height: 140px;
      border-radius: var(--ktk-radius-tile);
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(42, 26, 16, 0.3);
      border: 4px solid var(--ktk-primary);
      background: var(--ktk-primary);
    }

    .ktk-splash-logo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ktk-splash-name {
      font-family: var(--ktk-font-serif);
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      color: var(--ktk-primary-contrast);
      margin: 0;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .ktk-splash-tagline {
      font-family: var(--ktk-font-sans);
      font-size: clamp(0.875rem, 2vw, 1rem);
      font-weight: 600;
      color: var(--ktk-primary);
      margin: 0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .ktk-splash-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(250, 248, 242, 0.3);
      border-top-color: var(--ktk-primary-contrast);
      border-radius: 50%;
      animation: ktk-spin 0.8s linear infinite;
    }

    @keyframes ktk-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ktk-splash {
        transition: none;
      }
      .ktk-splash-spinner {
        animation: none;
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
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}