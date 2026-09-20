import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import {
  VouchersService,
  type Voucher,
} from '../../services/vouchers.service';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURED_IMG = 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=480&h=260&fit=crop&auto=format';

interface PromoCard extends Voucher {
  accent: 'coral' | 'yellow' | 'brown';
}

const ACCENTS: PromoCard['accent'][] = ['coral', 'yellow', 'brown'];

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-promotions',
  imports: [
    CommonModule,
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './promotions.component.html',
})
export class PromotionsComponent {
  private readonly vouchers = inject(VouchersService);
  private readonly auth = inject(AuthService);

  readonly featuredImg = FEATURED_IMG;
  readonly user = this.auth.user;

  readonly cards = signal<PromoCard[]>([]);
  readonly claimedIds = signal<Set<string>>(new Set());
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly claimingId = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly copied = signal<string | null>(null);

  readonly activeCount = computed(() => this.cards().length);

  readonly maxDiscountPct = computed(() =>
    Math.max(
      0,
      ...this.cards()
        .filter((c) => c.discount_type === 'percent')
        .map((c) => c.discount_value)
    )
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [available, claimed] = await Promise.all([
        this.vouchers.listAvailable(),
        this.vouchers.myClaimed(),
      ]);
      this.cards.set(
        available.map((v, i) => ({ ...v, accent: ACCENTS[i % ACCENTS.length] }))
      );
      this.claimedIds.set(
        new Set(
          claimed
            .filter((c) => c.voucher && c.status === 'claimed')
            .map((c) => c.voucher_id)
        )
      );
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : 'Could not load promotions.');
    } finally {
      this.loading.set(false);
    }
  }

  isClaimed(voucherId: string): boolean {
    return this.claimedIds().has(voucherId);
  }

  isBusy(voucherId: string): boolean {
    return this.claimingId() === voucherId;
  }

  /** Short label shown in the card badge. */
  badgeFor(card: PromoCard): string {
    if (card.code === 'WELCOME15') return 'New Member';
    if (card.code === 'FREEDEL500') return 'Delivery Perk';
    if (card.eligible_categories.length > 0) return card.eligible_categories[0];
    return card.discount_type === 'percent' ? 'Percent Off' : 'Fixed Discount';
  }

  /** Human-readable expiry, e.g. "Ends Jan 31" or "Ongoing". */
  expiryFor(card: PromoCard): string {
    if (!card.expires_at) return 'Ongoing';
    return `Ends ${new Date(card.expires_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`;
  }

  /** Human-readable discount summary, e.g. "20% off" or "₱320 off". */
  discountFor(card: PromoCard): string {
    if (card.discount_type === 'percent') return `${card.discount_value}% off`;
    return `₱${card.discount_value.toFixed(2)} off`;
  }

  /** Eligibility line, e.g. "Min ₱200 spend · Pastries only" or "No minimum". */
  eligibilityFor(card: PromoCard): string {
    const parts: string[] = [];
    const spend = card.minimum_spend > 0 ? `Min ₱${card.minimum_spend.toFixed(2)} spend` : 'No minimum';
    const scope = card.eligible_categories.length
      ? `${card.eligible_categories.join(' or ')} only`
      : 'Any order';
    parts.push(spend, scope);
    if (card.max_discount != null) parts.push(`Up to ₱${card.max_discount.toFixed(2)}`);
    return parts.join(' · ');
  }

  async handleClaim(card: PromoCard): Promise<void> {
    this.notice.set(null);
    if (!this.user()) {
      this.notice.set('Sign in to claim this voucher — it is saved to your account.');
      return;
    }
    this.claimingId.set(card.id);
    try {
      await this.vouchers.claim(card.id);
      this.claimedIds.update((ids) => new Set(ids).add(card.id));
      this.notice.set(`"${card.code}" claimed! It is ready to use at checkout.`);
    } catch (err) {
      this.notice.set(err instanceof Error ? err.message : 'Could not claim this voucher.');
    } finally {
      this.claimingId.set(null);
    }
  }

  handleCopy(code: string): void {
    navigator.clipboard.writeText(code).catch(() => {});
    this.copied.set(code);
    setTimeout(() => this.copied.set(null), 2000);
  }
}