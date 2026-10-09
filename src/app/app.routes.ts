import { Routes } from '@angular/router';
import { staffGuard } from './guards/role.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'bread-catalog', pathMatch: 'full' },
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
    canActivate: [authGuard],
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
    path: 'payment-success',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/payment-success/payment-success.component').then((m) => m.PaymentSuccessComponent),
  },
  {
    path: 'payment-cancelled',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/payment-cancelled/payment-cancelled.component').then((m) => m.PaymentCancelledComponent),
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
    path: 'custom-order',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/custom-order/custom-order.component').then((m) => m.CustomOrderComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then((m) => m.NotificationsComponent),
  },
  {
    path: 'about-products',
    loadComponent: () => import('./pages/about-products/about-products.component').then((m) => m.AboutProductsComponent),
  },
  {
    path: 'contact-us',
    loadComponent: () => import('./pages/contact-us/contact-us.component').then((m) => m.ContactUsComponent),
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
  {
    path: 'order-oversight',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./pages/order-oversight/order-oversight.component').then(
        (m) => m.OrderOversightComponent
      ),
  },
  { path: '**', redirectTo: 'bread-catalog' },
];