# PHASE 0: AUDIT REPORT — Knead to Know Bakery App

**Date:** 2026-10-24  
**Project:** Knead to Know (Angular 18 + Ionic 8 + Supabase + PayMongo)

---

## 1. PAGES, COMPONENTS & ROUTES MAPPED TO MOCKUP SCREENS

| Route / Path | Component | Mockup Screen | Notes |
|--------------|-----------|---------------|-------|
| `/` (redirect) | — | — | Redirects to `/bread-catalog` |
| `/splash` | `SplashScreenComponent` (inline in app.html) | **Splash** | Shows logo, name, tagline, spinner — timed 2.5s |
| `/login` | `LoginComponent` | **Sign In** | Email/password, "Create account" link |
| `/register` | `RegisterComponent` | **Create Account** | Display name, email, password, confirm |
| `/bread-catalog` | `BreadCatalogComponent` | **Shop / Catalog** | Search, category pills, filters, 2-col grid, product modal |
| `/dashboard` | `DashboardComponent` | **Home** | Hero, category circles, featured products, chef, testimonials, newsletter |
| `/orders` | `OrdersComponent` | **Orders (History + Cart tabs)** | Stats cards, tabs (History/Cart), fulfill cards (staff) or order cards (user) |
| `/orders` (fragment `#cart`) | `OrdersComponent` (cart tab) | **Cart Sheet** | Full cart list, qty controls, totals, checkout CTA |
| `/checkout` | `CheckoutComponent` | **Checkout (4 steps)** | Step 1: Bag, Step 2: Fulfillment, Step 3: Details/Schedule, Step 4: Payment + Voucher + Place Order |
| `/order-confirmation/:id` | `OrderConfirmationComponent` | **Receipt** | Printable receipt, status badge, items, totals, delivery info, "Print / Save as PDF" |
| `/payment-success` | `PaymentSuccessComponent` | **Payment Received** | Status icon, order reference, "View My Orders", "Continue Shopping" |
| `/payment-cancelled` | `PaymentCancelledComponent` | **Payment Cancelled** | Close icon, order ref, "Try Again", "View Orders", "Continue Shopping" |
| `/order-oversight` | `OrderOversightComponent` | **Order Tracking (Staff)** | Metrics cards, donut chart, orders table with tabs (All/Pending/Delivering/Finished), inventory alerts |
| `/admin` | `AdminComponent` | **Admin Panel (OLD)** | Tabs: Products, Inventory, Categories, Users & Roles, Orders, Sales — **TO BE REPLACED/RESTRICTED** |
| `/promotions` | `PromotionsComponent` | **Promotions** | Hero banner, stats strip, promo cards (ticket style), claim buttons, code copy |
| `/feedback` | `FeedbackComponent` | **Reviews** | Rating breakdown bars, write review form (product select, stars, comment), review list |
| `/about-products` | `AboutProductsComponent` | **Our Craft** | Hero, category cards, ingredient philosophy grid, promise cards |
| `/contact-us` | `ContactUsComponent` | **Contact Us** | Quick channels, locations with maps, contact form, social links |
| `/developers` | `DevelopersComponent` | **Developers** | Team cards with avatars/bios/skills, tech stack pills |
| `/custom-order` | `CustomOrderComponent` | **Custom Order** | Form (name, phone, description, qty, deadline), success state |
| `/profile` | `ProfileComponent` | **Account (Profile/Addresses/Password tabs)** | Edit profile, manage addresses, change password |
| `/notifications` | `NotificationsComponent` | **Notifications** | List with unread dots, icons per type, "Read all" |
| **Side Menu** | `MenuComponent` (ion-menu) | **Side Menu** | Brand logo, grouped nav (Shop/Account/Info/Admin), user avatar + role, logout |

---

## 2. MISSING SCREENS (per mockups)

| Mockup Screen | Status | Notes |
|---------------|--------|-------|
| **Welcome** (post-splash, pre-login) | ❌ MISSING | Splash goes directly to `/bread-catalog` (or `/dashboard` if logged in). No dedicated welcome/onboarding screen. |
| **Product Popup** | ✅ EXISTS | `ProductDetailModalComponent` — used as bottom sheet on mobile, but needs to be a centered modal on desktop. |
| **Cart Sheet** | ✅ EXISTS | `FloatingCartComponent` (popover) + Orders page cart tab — needs to be a bottom sheet on mobile, centered modal on desktop. |
| **Order Tracking (Customer)** | ⚠️ PARTIAL | Customer sees status in `OrderConfirmationComponent` and `OrdersComponent`, but no dedicated "live tracking" page with timeline + countdown. |
| **Side Menu** | ✅ EXISTS | `MenuComponent` — needs responsive behavior: overlay on mobile, persistent sidebar on desktop (via `ion-split-pane`). |
| **Admin User Management** | ⚠️ PARTIAL | Exists as "Users & Roles" tab in `/admin` — but admin should NOT have access to ordering system. Needs separate `/admin/users` layout. |
| **Admin Stock Management** | ✅ EXISTS | "Inventory" + "Products" + "Categories" tabs in `/admin` — staff should also access. |

---

## 3. OLD ADMIN SCREENS TO RESTRUCTURE/REMOVE

| Current Screen | Route | Action Required |
|----------------|-------|-----------------|
| Admin Panel (monolithic) | `/admin` | **Split**: Admin → `/admin/users` (User Management only). Staff → `/staff` (Products, Inventory, Categories, Orders, Custom Orders). |
| Admin "Orders" tab | `/admin` (tab) | **Move** to Staff dashboard (`/staff/orders`) with status workflow. |
| Admin "Sales" tab | `/admin` (tab) | **Move** to Staff dashboard (`/staff/sales`). |
| Admin "Products/Inventory/Categories" tabs | `/admin` (tabs) | **Move** to Staff dashboard (`/staff/products`, `/staff/inventory`, `/staff/categories`). Admin retains read-only stock view if needed. |
| Custom Order requests | `/admin` (not visible) | **Add** to Staff dashboard — trigger exists in `custom_orders` table. |
| Admin side menu entries | `MenuComponent` | **Hide** Shop, Cart, Orders, Custom Order, Promotions, Reviews from admin. Keep: Account, Notifications, Contact Us, Log Out. |

---

## 4. KEY TECHNICAL FINDINGS

### Design System (Current)
- **Palette (OLD — TO BE REPLACED):** `#F9E6A8` base, `#F2A900` navbar, `#E5D3AF` buttons, `#4D2A00` dark, `#CC6F00` burnt
- **Typography:** `Inter` only (no serif for headings/prices)
- **Radii:** Cards 16px, Buttons 12px, Inputs 10px, Pills 999px
- **Theme:** Light-only, CSS variables in `_variables.scss`, mapped to Ionic CSS vars

### Architecture
- **AuthService**: Roles = `customer` | `store_admin` | `admin` (stored in `user_roles` table)
- **Guards**: `authGuard` (signed in), `staffGuard` (`store_admin` or `admin`), `adminOnlyGuard` (`admin`)
- **RLS**: Comprehensive policies on all tables using `public.has_role()`
- **Orders**: `place_order()` SECURITY DEFINER RPC — server-authoritative pricing, stock, voucher redemption
- **Payments**: PayMongo via Edge Functions (`create-payment`, `payment-return`, `paymongo-webhook`)
- **Realtime**: Orders, cart_items, products notifications
- **Cart**: Dual backend (Supabase `cart_items` for logged-in, localStorage for guests)

### Components Needing Restyle/Restructure
1. **All pages** — inline styles → design tokens + shared components
2. **Product cards** — used in Dashboard, BreadCatalog, Admin — inconsistent markup
3. **Category pills/tabs** — multiple implementations (`.bakery-pill`, `.bakery-tab`, `.oo-tab`, inline)
4. **Status badges** — `.status-badge` variants + inline chips
5. **Form fields** — inconsistent `.checkout-field`, `.admin-field-label`, `.admin-ion-input`
6. **Buttons** — inline `ion-button` styles everywhere, no shared classes
7. **Modals/Sheets** — `ProductDetailModalComponent` (fixed), `FloatingCartComponent` (popover), no shared bottom-sheet component
8. **Empty/Error states** — duplicated markup across pages
9. **Icons** — registered ad-hoc in each component, causing "unregistered icon" warnings

---

## 5. ASSUMPTIONS FOR PHASE 1+

1. **Mockup PDF** is the single source of truth — I will interpret ambiguous areas consistently.
2. **Roles renamed**: `customer` → `user`, `store_admin` → `staff`, `admin` → `admin` (keep DB values, update UI labels).
3. **Fonts**: Self-host **Lora** (serif, headings/prices) + **Lato** (sans, body) via `@font-face` in `variables.scss`.
4. **Pastel tile colors** for product/category backgrounds: 6 colors rotated.
5. **Breakpoints**: `<576` phone, `576-991` tablet, `≥992` desktop, `≥1400` wide desktop.
6. **Admin redirect**: After login, admin → `/admin/users`, staff → `/staff/dashboard`, user → `/dashboard` (Home).
7. **Admin blocking**: Route guards + RLS + `place_order()` RPC check.
8. **Edge Functions**: CORS already handled in `_shared/cors.ts` — ensure OPTIONS works.
9. **Migrations**: New numbered files only (0013+, 0014+), never edit existing.
10. **Testing checkpoints**: 360px, 768px, 1024px, 1440px after each phase.

---

## 6. FILES TO CREATE/MODIFY (High-Level Plan)

### Phase 1: Design Tokens
- `src/theme/tokens.scss` (new — single source of truth)
- `src/theme/variables.scss` (rewrite — map tokens to Ionic vars)
- `src/styles.scss` (import tokens first)

### Phase 2: Shared Components (standalone, in `src/app/shared/`)
- `PageHeaderComponent` — menu/back btn, title, notification bell
- `ButtonComponent` — primary/outline/amber/disabled, pill radius
- `ChipComponent` — category, filter, status
- `StatusTagComponent` — order/stock status
- `FormFieldComponent` — icon, label, helper, error
- `SegmentedTabsComponent` — 4-step checkout, category pills
- `ProductCardComponent` — pastel tile, heart, name, rating, price, + btn, sold-out
- `CategoryTileComponent` — circle image + label
- `TicketCardComponent` — dashed notch edge (orders, promos, custom orders)
- `BottomSheetComponent` — wrapper for product popup, cart (mobile sheet → desktop modal)
- `TabBarComponent` — bottom tabs (Home, Shop, Orders, Account) with amber pill
- `FloatingCartBarComponent` — item count + total, hides on checkout/admin
- `EmptyStateComponent` — illustration, title, text, action btn
- `ErrorStateComponent` — same + retry
- `SkeletonLoaderComponent` — card, line, avatar variants
- `ToastService` — wrapper for consistent toasts
- `StepIndicatorComponent` — 4 segments (checkout)
- `TimelineComponent` — vertical (order tracking)
- `IconRegistry` — single `addIcons()` call in `app.ts` for all Ionicons used

### Phase 3: Responsive Layout
- `src/app/app.html` — `ion-split-pane` with `when="(min-width: 992px)"`
- `src/app/shared/layout/` — `ContentContainerComponent` (max-width 1200px, centered)
- Grid utilities: `.grid-auto-2`, `.grid-auto-3`, `.grid-auto-4`, `.grid-auto-5`
- Safe-area padding utilities
- Bottom padding for floating cart/tab bar

### Phase 4: Immersive Experience
- Splash screen redesign (amber bg, logo tile, tagline, fade/scale animation)
- Page transitions (custom `NavController` animation builder)
- Staggered fade-up (CSS `animation-delay` via `:nth-child`)
- Floating shadow on product tiles
- Cart bump animation (FAB badge + `Haptics.impact()`)
- Drag-handle bottom sheets (use Ionic `ion-modal` with `can-dismiss="true"` + `backdrop-breakpoint`)
- Pull-to-refresh on Shop, Orders, Notifications
- Realtime order tracking timeline + countdown
- `prefers-reduced-motion` respected globally

### Phase 5: Screen Rebuilds
- Rebuild each page using shared components + tokens + real Supabase data

### Phase 6: Roles & Admin Restriction
- **Migration 0013**: Add `role` column to `profiles` (denormalized for fast client reads) + audit table `role_changes`
- **Migration 0014**: RLS policies — admin cannot read/insert orders/cart/order_items; admin+staff manage products/stock; users edit own profile only
- **Migration 0015**: Update `place_order()` to reject `admin` callers
- **Edge Function** (or SECURITY DEFINER RPC): `admin_create_user`, `admin_update_user_role`, `admin_disable_user`, `admin_delete_user` — all check caller is admin + safeguards
- **Route Guards**: `adminGuard` (redirects admin from ordering routes), `staffGuard` (allows staff+admin to staff routes), `userGuard` (blocks staff/admin from user routes)
- **Admin Layout**: `/admin/users` with sidebar (desktop) / side menu (mobile) — User Management only
- **Staff Layout**: `/staff` with sidebar — Products, Inventory, Categories, Orders, Custom Orders, Sales

### Phase 7: Verify & Report
- `ng build --configuration production` — zero errors/warnings
- Console clean: no Ionicons warnings, no CORS errors
- Manual walkthrough: admin, staff, user at 360px and 1440px
- Final report with file list, migrations, Edge Function deploys, assumptions

---

## 7. IMMEDIATE NEXT STEPS

1. **Create design tokens** (`tokens.scss`, rewrite `variables.scss`)
2. **Register all Ionicons** once in `app.ts`
3. **Build shared component library** in `src/app/shared/`
4. **Run `ng build`** — fix errors before proceeding to Phase 3

---

*End of Phase 0 Audit.*