# Phase 3 Implementation Plan: Responsive Universal Layout

## Objective
Make all pages responsive across phone (<576px), tablet (576-991px), desktop (992-1399px), wide desktop (>=1400px) using shared components and design tokens.

## Steps

### 1. Update Global Layout Utilities
- [ ] Add responsive container component
- [ ] Add page wrapper with safe areas
- [ ] Verify grid utilities work at all breakpoints

### 2. Update Core Pages (High Priority)
- [ ] **Dashboard** (`/dashboard`) - Hero, category circles, product grid, chef section, testimonials, newsletter
- [ ] **Bread Catalog** (`/bread-catalog`) - Search, category pills, filters, product grid, CTA strip
- [ ] **Orders** (`/orders`) - Stats cards, tabs (History/Cart), fulfill/order cards
- [ ] **Checkout** (`/checkout`) - 4-step layout, form fields, payment options, summary
- [ ] **Order Confirmation** (`/order-confirmation/:id`) - Receipt, print button, actions

### 3. Update Secondary Pages
- [ ] **Promotions** (`/promotions`) - Hero, stats, promo cards (ticket style)
- [ ] **Notifications** (`/notifications`) - List with unread dots, read all
- [ ] **Feedback/Reviews** (`/feedback`) - Rating breakdown, write review form, review list
- [ ] **Custom Order** (`/custom-order`) - Form with validation
- [ ] **Profile** (`/profile`) - Tabs (Profile/Addresses/Password)
- [ ] **About Products** (`/about-products`) - Category cards, ingredient philosophy, promises
- [ ] **Contact Us** (`/contact-us`) - Channels, locations, contact form
- [ ] **Developers** (`/developers`) - Team cards, tech stack
- [ ] **Order Oversight** (`/order-oversight`) - Metrics, donut chart, orders table, inventory alerts

### 4. Update Auth Pages
- [ ] **Login** (`/login`) - Centered card, branding
- [ ] **Register** (`/register`) - Centered card, branding

### 5. Responsive Navigation
- [ ] Update `MenuComponent` for desktop sidebar (persistent) vs mobile overlay
- [ ] Update `TabBarComponent` - hide on desktop, show on mobile
- [ ] Update `FloatingCartBarComponent` - positioning with safe areas

### 6. Splash & Page Transitions
- [ ] Update `SplashScreenComponent` with new design (amber bg, logo tile, tagline)
- [ ] Add page transition animations (slide/fade 250-350ms ease-out)

### 7. Test & Verify
- [ ] Run `ng build` - no errors
- [ ] Test at 360px, 768px, 1024px, 1440px (manual verification)
- [ ] Verify no horizontal scroll at any width 320px-2560px
- [ ] Verify floating cart/tab bar never cover primary buttons

---

## File Mapping

| Page | Component File | Template File |
|------|----------------|---------------|
| Dashboard | `src/app/pages/dashboard/dashboard.component.ts` | `.html` |
| Bread Catalog | `src/app/pages/bread-catalog/bread-catalog.component.ts` | `.html` |
| Orders | `src/app/pages/orders/orders.component.ts` | `.html` |
| Checkout | `src/app/pages/checkout/checkout.component.ts` | `.html` |
| Order Confirmation | `src/app/pages/order-confirmation/order-confirmation.component.ts` | `.html` |
| Promotions | `src/app/pages/promotions/promotions.component.ts` | `.html` |
| Notifications | `src/app/pages/notifications/notifications.component.ts` | `.html` |
| Feedback | `src/app/pages/feedback/feedback.component.ts` | `.html` |
| Custom Order | `src/app/pages/custom-order/custom-order.component.ts` | `.html` |
| Profile | `src/app/pages/profile/profile.component.ts` | `.html` |
| About Products | `src/app/pages/about-products/about-products.component.ts` | `.html` |
| Contact Us | `src/app/pages/contact-us/contact-us.component.ts` | `.html` |
| Developers | `src/app/pages/developers/developers.component.ts` | `.html` |
| Order Oversight | `src/app/pages/order-oversight/order-oversight.component.ts` | `.html` |
| Login | `src/app/pages/login/login.component.ts` | `.html` |
| Register | `src/app/pages/register/register.component.ts` | `.html` |
| Splash | `src/app/components/splash-screen/splash-screen.component.ts` | inline |
| Menu | `src/app/components/menu/menu.component.ts` | `.html` + `.scss` |
| Tab Bar | `src/app/shared/components/tab-bar/tab-bar.component.ts` | inline |
| Floating Cart | `src/app/shared/components/floating-cart-bar/floating-cart-bar.component.ts` | inline |