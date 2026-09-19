import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

// Default categories that are always present (seeded in SQL) – shown even if
// the DB call fails so the admin form always has a usable dropdown.
export const DEFAULT_CATEGORIES = [
  'Breads', 'Pastries', 'Cakes', 'Cookies', 'Muffins', 'Seasonal',
] as const;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly db = inject(DatabaseService);

  /** Returns all categories, ordered alphabetically. */
  async list(): Promise<Category[]> {
    const { data, error } = await this.db.client
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Category[];
  }

  /** Returns just the category names (for dropdowns). */
  async listNames(): Promise<string[]> {
    const cats = await this.list();
    return cats.map((c) => c.name);
  }

  /** Creates a new category. Throws if the name already exists. */
  async create(name: string): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name cannot be empty.');
    const { data, error } = await this.db.client
      .from('categories')
      .insert({ name: trimmed })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error(`Category "${trimmed}" already exists.`);
      throw new Error(error.message);
    }
    return data as unknown as Category;
  }

  /** Deletes a category by id. */
  async remove(id: string): Promise<void> {
    const { error } = await this.db.client
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}
