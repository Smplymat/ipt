import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { DatabaseService } from './database.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppRole = 'customer' | 'store_admin' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
}

const ROLES: AppRole[] = ['customer', 'store_admin', 'admin'];

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly db = inject(DatabaseService);
  private readonly router = inject(Router);

  /** Current signed-in user (null when signed out). */
  readonly user = signal<AuthUser | null>(null);

  /** Becomes true once the persisted session has been loaded / rejected. */
  readonly ready = signal(false);

  /** Resolves when the initial session state has been determined. */
  private readonly readyPromise: Promise<void>;
  private resolveReady!: () => void;

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly canManageProducts = computed(() => {
    const role = this.user()?.role;
    return role === 'admin' || role === 'store_admin';
  });

  constructor() {
    this.readyPromise = new Promise<void>((resolve) => (this.resolveReady = resolve));
    this.db.client.auth.onAuthStateChange((_event, session) => {
      void this.syncSession(session);
    });
    if (this.ready() === false) {
      void this.refresh();
    }
  }

  /** Wait until the persisted session has been resolved (used by guards). */
  waitForSession(): Promise<void> {
    return this.readyPromise;
  }

  /** Re-read the currently stored session and refresh the user signal. */
  async refresh(): Promise<void> {
    const {
      data: { user },
    } = await this.db.client.auth.getUser();
    await this.syncSession(user ? ({ user } as Session) : null);
  }

  private async syncSession(session: Session | null): Promise<void> {
    if (!session?.user) {
      this.user.set(null);
      this.ready.set(true);
      return;
    }

    const u = session.user;
    let role: AppRole = 'customer';

    const { data, error } = await this.db.client
      .from('user_roles')
      .select('role')
      .eq('user_id', u.id)
      .maybeSingle();

    if (!error && data && ROLES.includes(data.role as AppRole)) {
      role = data.role as AppRole;
    }

    this.user.set({
      id: u.id,
      email: u.email ?? '',
      displayName:
        typeof u.user_metadata?.['display_name'] === 'string'
          ? (u.user_metadata['display_name'] as string)
          : (u.email?.split('@')[0] ?? ''),
      role,
    });

    this.ready.set(true);
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  async signIn(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
    const { error } = await this.db.client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    await this.refresh();
    return { ok: true };
  }

  async signUp(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ ok: boolean; message?: string; needEmailConfirmation?: boolean }> {
    const { data, error } = await this.db.client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() || email.split('@')[0] } },
    });
    if (error) return { ok: false, message: error.message };
    // When email confirmation is enabled, no session exists yet.
    if (!data.session) return { ok: true, needEmailConfirmation: true };
    await this.refresh();
    return { ok: true };
  }

  async signOut(): Promise<void> {
    try {
      await this.db.client.auth.signOut();
    } finally {
      this.user.set(null);
      await this.router.navigate(['/login']);
    }
  }

  /** Send the signed-in user to the dashboard that matches their role. */
  async redirectAfterAuth(): Promise<void> {
    const u = this.user();
    if (!u) {
      await this.router.navigate(['/login']);
      return;
    }
    const target = u.role === 'admin' || u.role === 'store_admin' ? '/admin' : '/dashboard';
    await this.router.navigate([target]);
  }

  // ── Role management (Super Admin only) ─────────────────────────────────────

  /** List every registered user with their assigned role. */
  async listUsers(): Promise<AuthUser[]> {
    const [profilesRes, rolesRes] = await Promise.all([
      this.db.client.from('profiles').select('id,email,display_name'),
      this.db.client.from('user_roles').select('user_id,role'),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const roleMap = new Map<string, AppRole>(
      (rolesRes.data ?? []).map((r) => [r.user_id, r.role as AppRole])
    );

    return (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      displayName: p.display_name ?? p.email.split('@')[0],
      role: roleMap.get(p.id) ?? 'customer',
    }));
  }

  /** Reassign a user's role. RLS only permits Admin to do this. */
  async updateUserRole(userId: string, role: AppRole): Promise<void> {
    const { error } = await this.db.client.from('user_roles').update({ role }).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}