import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import { AuthService } from './auth.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient: string;
  phone: string;
  address_line: string;
  city: string;
  is_default: boolean;
  created_at: string;
}

export type NewAddress = Pick<Address, 'label' | 'recipient' | 'phone' | 'address_line' | 'city'> & {
  is_default?: boolean;
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AddressesService {
  private readonly db = inject(DatabaseService);
  private readonly auth = inject(AuthService);

  /** The signed-in user's saved addresses, newest first. */
  async list(): Promise<Address[]> {
    const { data, error } = await this.db.client
      .from('addresses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Address[];
  }

  /** Adds an address, promoting it to default when the book is empty. */
  async create(input: NewAddress): Promise<Address> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in to save an address.');

    const { data, error } = await this.db.client
      .from('addresses')
      .insert({
        user_id: user.id,
        label: input.label || 'Home',
        recipient: input.recipient,
        phone: input.phone,
        address_line: input.address_line,
        city: input.city,
        is_default: input.is_default ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (input.is_default) await this.makeDefault((data as unknown as Address).id);
    return data as unknown as Address;
  }

  /** Promotes one address to default (clears the rest first). */
  async makeDefault(id: string): Promise<void> {
    const {
      data: { user },
    } = await this.db.client.auth.getUser();
    if (!user) return;

    await this.db.client.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    await this.db.client.from('addresses').update({ is_default: true }).eq('id', id).eq('user_id', user.id);
  }

  async update(id: string, patch: Partial<NewAddress>): Promise<void> {
    const { error } = await this.db.client.from('addresses').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.client.from('addresses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}