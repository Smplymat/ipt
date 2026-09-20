import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly db = inject(DatabaseService);

  /**
   * Adds an email to the newsletter list. The table's unique (LOWER(email))
   * constraint makes re-subscribing a no-op, so the caller is told the address
   * is already on the list rather than treated as an error.
   */
  async subscribe(email: string): Promise<{ alreadySubscribed: boolean }> {
    const { error } = await this.db.client.from('newsletter_subscribers').insert({ email });
    if (error) {
      if (error.code === '23505') return { alreadySubscribed: true };
      throw new Error(error.message);
    }
    return { alreadySubscribed: false };
  }
}