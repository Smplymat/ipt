import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonType = 'card' | 'text' | 'circular' | 'rectangular' | 'avatar' | 'button' | 'product-card';

@Component({
  selector: 'ktk-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (type) {
      @case ('card') {
        <div class="skeleton-card">
          <div class="skeleton-line" style="width: 60%; height: 16px; border-radius: var(--ktk-radius-small);"></div>
          <div class="skeleton-line" style="width: 100%; height: 140px; border-radius: var(--ktk-radius-tile) var(--ktk-radius-tile) 0 0;"></div>
          <div class="skeleton-line" style="width: 80%; height: 16px; margin-top: var(--ktk-space-3);"></div>
          <div class="skeleton-line" style="width: 60%; height: 12px; margin-top: var(--ktk-space-2);"></div>
          <div class="skeleton-line" style="width: 100%; height: 12px; margin-top: var(--ktk-space-2);"></div>
          <div class="skeleton-line" style="width: 100%; height: 12px; margin-top: var(--ktk-space-2);"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--ktk-space-3);">
            <div class="skeleton-line" style="width: 50px; height: 20px; border-radius: var(--ktk-radius-small);"></div>
            <div class="skeleton-line" style="width: 96px; height: 44px; border-radius: var(--ktk-radius-button);"></div>
          </div>
        </div>
      }
      @case ('product-card') {
        <article class="skeleton-product-card">
          <div class="skeleton-line price-tag" style="width: 60px; height: 24px; border-radius: var(--ktk-radius-button);"></div>
          <div class="skeleton-line category-chip" style="width: 80px; height: 28px; border-radius: var(--ktk-radius-button);"></div>
          <div class="skeleton-img" style="aspect-ratio: 4/3; border-radius: var(--ktk-radius-tile) var(--ktk-radius-tile) 0 0;"></div>
          <div class="skeleton-body">
            <div class="skeleton-line" style="width: 70%; height: 20px; margin-bottom: var(--ktk-space-2);"></div>
            <div class="skeleton-line" style="width: 100px; height: 14px; margin-bottom: var(--ktk-space-2);"></div>
            <div class="skeleton-line" style="width: 100%; height: 12px; margin-bottom: var(--ktk-space-2);"></div>
            <div class="skeleton-line" style="width: 100%; height: 12px; margin-bottom: var(--ktk-space-3);"></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="skeleton-line" style="width: 60px; height: 24px; border-radius: var(--ktk-radius-small);"></div>
              <div class="skeleton-line" style="width: 96px; height: 44px; border-radius: var(--ktk-radius-button);"></div>
            </div>
          </div>
        </article>
      }
      @case ('text') {
        <div class="skeleton-text">
          @for (line of lines; track $index) {
            <div class="skeleton-line" [style.width]="line"></div>
          }
        </div>
      }
      @case ('circular') {
        <div class="skeleton-circular" [style.width.px]="size" [style.height.px]="size"></div>
      }
      @case ('rectangular') {
        <div class="skeleton-rectangular" [style.width]="width" [style.height]="height"></div>
      }
      @case ('avatar') {
        <div class="skeleton-avatar" [style.width.px]="size" [style.height.px]="size"></div>
      }
      @case ('button') {
        <div class="skeleton-button" [style.width]="width" [style.height.px]="height"></div>
      }
    }
  `,
  styles: [`
    .skeleton-line {
      background: linear-gradient(
        90deg,
        var(--ktk-muted-beige) 25%,
        var(--ktk-base-tint) 50%,
        var(--ktk-muted-beige) 75%
      );
      background-size: 200% 100%;
      animation: ktk-shimmer 1.5s ease-in-out infinite;
      border-radius: var(--ktk-radius-small);
    }

    @keyframes ktk-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-line {
        animation: none;
        background: var(--ktk-muted-beige);
      }
    }

    /* Card skeleton */
    .skeleton-card {
      background: var(--ktk-card-bg);
      border: 1px solid var(--ktk-card-border);
      border-radius: var(--ktk-radius-card);
      padding: var(--ktk-space-3);
      box-shadow: var(--ktk-shadow-card);
    }

    .skeleton-product-card {
      background: var(--ktk-card-bg);
      border: 1px solid var(--ktk-card-border);
      border-radius: var(--ktk-radius-card);
      overflow: hidden;

      .skeleton-img {
        background: var(--ktk-muted-beige);
      }

      .skeleton-body {
        padding: var(--ktk-space-3);
      }

      .price-tag {
        position: absolute;
        top: var(--ktk-space-3);
        right: var(--ktk-space-3);
      }

      .category-chip {
        position: absolute;
        top: var(--ktk-space-3);
        left: var(--ktk-space-3);
      }
    }

    /* Text skeleton */
    .skeleton-text {
      display: flex;
      flex-direction: column;
      gap: var(--ktk-space-2);
    }

    .skeleton-text .skeleton-line {
      height: 14px;
      border-radius: 4px;
    }

    /* Circular skeleton */
    .skeleton-circular {
      border-radius: 50%;
    }

    /* Rectangular skeleton */
    .skeleton-rectangular {
      border-radius: var(--ktk-radius-input);
    }

    /* Avatar skeleton */
    .skeleton-avatar {
      border-radius: 50%;
    }

    /* Button skeleton */
    .skeleton-button {
      border-radius: var(--ktk-radius-button);
    }
  `]
})
export class SkeletonComponent {
  @Input() type: SkeletonType = 'rectangular';
  @Input() lines: (string | number)[] = ['80%', '60%', '40%'];
  @Input() size = 48;
  @Input() width = '100%';
  @Input() height = 44;
}