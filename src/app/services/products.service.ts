import { Injectable, inject } from '@angular/core';
import { SUPABASE_STORAGE_BUCKET } from '../config/supabase.config';
import { DatabaseService } from './database.service';
import { toErrorMessage } from './orders.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtraInfoItem {
  id: string;       // client-side uuid for tracking
  label: string;    // heading / bullet title
  value: string;    // detail text
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  image_url: string;
  ingredients: string;
  nutritional_value: string;
  extra_info: ExtraInfoItem[];
  stock_quantity: number;
  created_at: string;
}

export type NewProduct = Omit<Product, 'id' | 'created_at'>;
export type ProductPatch = Partial<Omit<Product, 'id' | 'created_at'>>;

/** Quantities at or below this count are flagged as low stock. */
export const LOW_STOCK_THRESHOLD = 5;

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly db = inject(DatabaseService);

  // ── Read ────────────────────────────────────────────────────────────────────

  async list(): Promise<Product[]> {
    const { data, error } = await this.db.client
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Product[];
  }

  // ── Write ───────────────────────────────────────────────────────────────────

  async create(payload: NewProduct): Promise<Product> {
    const { data, error } = await this.db.client.from('products').insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data as unknown as Product;
  }

  async update(id: string, patch: ProductPatch): Promise<Product> {
    const { data, error } = await this.db.client
      .from('products')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as Product;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.client.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Image storage ──────────────────────────────────────────────────────────

  /**
   * Uploads a product image to the `product-images` bucket and
   * returns the public URL of the newly created object.
   *
   * Allowed types: JPEG, PNG, WebP, GIF — max 5 MB.
   */
  async uploadImage(file: File): Promise<string> {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file type "${file.type}". Please upload a JPEG, PNG, WebP, or GIF.`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`);
    }

    const ext =
      (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const key = `products/${crypto.randomUUID()}.${ext}`;

    const { error } = await this.db.client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(key, file, { upsert: false, contentType: file.type });

    if (error) throw new Error(`Image upload failed: ${error.message}`);

    return this.db.client.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key).data.publicUrl;
  }

  /** Best-effort removal of an object from storage by its public URL. */
  async deleteImageByUrl(url: string): Promise<void> {
    if (!url || !url.includes(PUBLIC_OBJECT_PREFIX)) return;
    const path = url.split(PUBLIC_OBJECT_PREFIX).pop();
    if (!path || path.length === 0) return;
    await this.db.client.storage.from(SUPABASE_STORAGE_BUCKET).remove([path]);
  }
}

export { toErrorMessage } from './orders.service';