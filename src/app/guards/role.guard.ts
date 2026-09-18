import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole, AuthService } from '../services/auth.service';

/**
 * Allows the route only for users holding one of the given roles.
 * - Signed out visitors are sent to /login.
 * - Signed-in users without the required role are sent to /dashboard.
 */
export function roleGuard(...allowed: AppRole[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.ready()) await auth.waitForSession();

    const user = auth.user();
    if (user && allowed.includes(user.role)) return true;
    return router.createUrlTree(user ? ['/dashboard'] : ['/login']);
  };
}

/** Store Admin or Admin — can manage the product catalog. */
export const staffGuard = roleGuard('store_admin', 'admin');

/** Admin (Super Admin) only — can also manage users. */
export const adminOnlyGuard = roleGuard('admin');