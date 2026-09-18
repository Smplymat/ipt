import { Injectable, inject } from '@angular/core';
import { SUPABASE_STORAGE_BUCKET } from '../config/supabase.config';
import { DatabaseService } from './database.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  image_url: string;
  created_at: string;
}

export type NewProduct = Omit<Product, 'id' | 'created_at'>;
export type ProductPatch = Partial<Omit<Product, 'id' | 'created_at'>>;

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
   */
  async uploadImage(file: File): Promise<string> {
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

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}