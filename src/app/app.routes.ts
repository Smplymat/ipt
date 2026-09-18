import { Routes } from '@angular/router';
import { staffGuard } from './guards/role.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'bread-catalog',
    loadComponent: () => import('./pages/bread-catalog/bread-catalog.component').then((m) => m.BreadCatalogComponent),
  },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/checkout/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    path: 'order-confirmation/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/order-confirmation/order-confirmation.component').then(
        (m) => m.OrderConfirmationComponent
      ),
  },
  {
    path: 'promotions',
    loadComponent: () => import('./pages/promotions/promotions.component').then((m) => m.PromotionsComponent),
  },
  {
    path: 'feedback',
    loadComponent: () => import('./pages/feedback/feedback.component').then((m) => m.FeedbackComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'developers',
    loadComponent: () => import('./pages/developers/developers.component').then((m) => m.DevelopersComponent),
  },
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./pages/admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];