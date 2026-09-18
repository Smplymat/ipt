import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabase.config';

/**
 * Lazily creates and shares a single Supabase client for the whole app.
 * Injectable at the root so every service/page gets the same instance.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private instance: SupabaseClient | null = null;

  get client(): SupabaseClient {
    if (!this.instance) {
      this.instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
    return this.instance;
  }
}