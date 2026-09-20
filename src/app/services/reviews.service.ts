import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  user_id: string;
  product_id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ReviewWithProduct extends Review {
  product: { id: string; name: string; image_url: string } | null;
  author: string;
}

export interface ProductRating {
  product_id: string;
  average: number;
  count: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly db = inject(DatabaseService);

  /** List every review joined with its product (public read). */
  async list(): Promise<ReviewWithProduct[]> {
    const { data, error } = await this.db.client
      .from('reviews')
      .select('*, product:products(name, image_url)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as Review),
      product: ((r['product'] as Record<string, unknown> | null) ?? null) as ReviewWithProduct['product'],
      author: String((r['author_name'] as string) ?? '') || 'Anonymous Baker',
    }));
  }

  /** The signed-in user's own review for a product (null when none). */
  async myReviewFor(productId: string): Promise<Review | null> {
    const {
      data: { user },
    } = await this.db.client.auth.getUser();
    if (!user) return null;
    const { data } = await this.db.client
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .maybeSingle();
    return data ? (data as unknown as Review) : null;
  }

  /** Create or update the caller's review for a product. */
  async save(productId: string, rating: number, comment: string): Promise<void> {
    const {
      data: { user },
    } = await this.db.client.auth.getUser();
    if (!user) throw new Error('You must be signed in to leave a review.');

    const existing = await this.myReviewFor(productId);
    const { error } = existing
      ? await this.db.client
          .from('reviews')
          .update({ rating, comment })
          .eq('id', existing.id)
      : await this.db.client.from('reviews').insert({ user_id: user.id, product_id: productId, rating, comment });
    if (error) throw new Error(error.message);
  }

  /** Average rating + review count per product (for catalog badges). */
  async productRatings(): Promise<Map<string, ProductRating>> {
    const { data, error } = await this.db.client
      .from('reviews')
      .select('product_id, rating');
    if (error) throw new Error(error.message);

    const map = new Map<string, { sum: number; count: number }>();
    for (const r of (data ?? []) as { product_id: string; rating: number }[]) {
      const cur = map.get(r.product_id) ?? { sum: 0, count: 0 };
      cur.sum += Number(r.rating);
      cur.count += 1;
      map.set(r.product_id, cur);
    }
    const out = new Map<string, ProductRating>();
    for (const [product_id, v] of map) {
      out.set(product_id, { product_id, average: v.sum / v.count, count: v.count });
    }
    return out;
  }
}