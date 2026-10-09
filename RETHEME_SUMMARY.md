# Knead to Know Bakery App - Re-theme Summary

## Files Changed

### Core Theme Files (3)
- **src/theme/_variables.scss** - Complete rewrite with full design token system
  - Brand palette: #F9E6A8 (base), #F2A900 (navbar), #E5D3AF (button), #4D2A00 (dark), #CC6F00 (burnt)
  - Derived surfaces: #FFF4D6 (card), #FDF3C4 (base-tint)
  - Status colors: Pending #B7791F, On Delivery #2B6CB0, Finished #2E7D4F, Cancelled #B3261E, Low Stock #CC6F00
  - Typography tokens: Inter font, h1 40px/700, h2 28px/700, h3 20px/600, body 16px, min 13px
  - Spacing: 8px grid, container max-width 1200px
  - Shape: card radius 16px, button radius 12px
  - Animation tokens: durations 150-400ms, ease-out, prefers-reduced-motion support
  - Ionic variable overrides: --ion-background-color, --ion-toolbar-background, --ion-color-primary, etc.
  - Light theme enforcement (removed dark mode)

- **src/theme/_menu.scss** - Light sidebar theme
  - Background #FFF4D6, 2px #4D2A00 right border
  - Group labels (Shop/Account/Info/Admin) in small bold uppercase #4D2A00 at 70%
  - Items: #4D2A00 text, hover #E5D3AF, active #4D2A00 bg with #F9E6A8 text + #CC6F00 left bar
  - Log Out as danger button (#B3261E)
  - Slide-in animation with dimmed backdrop

- **src/theme/_page-shared.scss** - Complete rewrite (~2000 lines)
  - All old SCSS variables ($cream, $brown, $coral) replaced with new palette CSS custom properties
  - Reusable component classes: .bakery-btn, .bakery-card, .bakery-badge, .bakery-tabs/.bakery-tab, .bakery-empty-state, .bakery-page-header, .bakery-skeleton, .bakery-stat-card
  - Button styling: 2px solid #4D2A00 border, #4D2A00 bold text (14px), 0 3px 0 #4D2A00 shadow, min-height 44px, hover lift + fill #CC6F00 with white text, press sink
  - Input styling: #FFFDF5 bg, 2px solid #4D2A00 border, #4D2A00 text, placeholder #4D2A00@60%, focus = #CC6F00 border + ring
  - Product grid: repeat(auto-fill, minmax(230px, 1fr))
  - Status badges with new status colors
  - Stat cards: #FFF4D6 with thick colored top border, icon, #4D2A00 big numbers
  - Animations: keyframes for button hover/press, card hover lift+zoom, skeleton shimmer, staggered entrance, hero parallax, floating particles, form shake, success checkmark
  - prefers-reduced-motion support
  - Print styles for receipts

### Page Templates Updated (16)
All 16 page templates had inline hex colors replaced with CSS custom properties:
- Dashboard, Bread Catalog, Custom Order, Orders, Checkout, Order Confirmation
- Notifications, Profile, Promotions, Feedback, About, Developers
- Order Oversight, Admin Management, Login, Register

### Component Files Updated
- src/app/components/menu/menu.component.ts - Added navigation groups (Shop/Account/Info/Admin) with groupedPages computed
- src/app/components/menu/menu.component.html - Grouped navigation with group labels, fixed user chip inline styles
- src/app/pages/notifications/notifications.component.ts - Added iconFor() method with ionicon mappings
- src/app/pages/notifications/notifications.component.html - Replaced text placeholders with ionicon circles (.notif-icon-circle)
- src/app/pages/profile/profile.component.ts - Added ionicon imports (createOutline, mailOutline, keyOutline)
- src/app/pages/profile/profile.component.html - Replaced emoji icons (U+270F/U+1F4EE/U+1F511) with ionicons
- src/app/pages/admin/admin.component.ts - Updated stockBadge() and statusChipColor() with new palette
- src/app/pages/order-oversight/order-oversight.component.ts - Updated STATUS_COLORS with new palette
- src/app/pages/notifications/notifications.component.ts - Fixed ionicon imports (basketOutline, giftOutline, etc.)

### Configuration Files
- src/index.html - Added Google Fonts (Inter), updated theme-color to #F2A900

## Contrast Checks & Adjustments

### Passing Contrast (>=4.5:1 normal, >=3:1 large)
| Combination | Ratio | Status |
|-------------|-------|--------|
| #4D2A00 on #F9E6A8 (base) | ~12:1 | Pass |
| #4D2A00 on #FFF4D6 (card) | ~11:1 | Pass |
| #4D2A00 on #E5D3AF (button) | ~8:1 | Pass |
| #4D2A00 on #F2A900 (navbar) | ~7.8:1 | Pass |
| #F9E6A8 on #4D2A00 | ~12:1 | Pass |
| #F2A900 on #4D2A00 | ~7.8:1 | Pass (navbar gold on dark) |
| #FFF on #CC6F00 (burnt) | ~3.6:1 | Borderline (UI component 3:1 OK) |
| #FFF on #B35E00 (burnt shade) | ~4.7:1 | Pass (active tab fix) |

### Adjustments Made
1. Section eyebrows (.bakery-section-eyebrow): Changed from var(--bakery-burnt) to var(--bakery-dark) on light backgrounds (was 2.87:1, now 12:1)
2. Newsletter eyebrow (.bakery-newsletter__eyebrow): Changed from var(--bakery-burnt) to var(--bakery-navbar) on dark (was 4.35:1, now 7.8:1)
3. Active tabs/pills (.bakery-tab--active, .bakery-pill--active): Background changed from var(--bakery-burnt) to var(--bakery-burnt-shade) (#B35E00) for white text (was 3.55:1, now 4.67:1)
3. Small text on cards (.pdm-category-badge, .fulfill-card__tel, .promo-card__badge, .admin-add-info-btn): Changed from var(--bakery-burnt) to var(--bakery-dark) (was ~3:1, now ~11:1)
4. Order tab active text (.oo-tab--active): Text color var(--bakery-burnt) to var(--bakery-dark), border kept burnt

## Bad Image Data Found

### Hardcoded Unsplash URLs (Dashboard)
| Line | Image | Issue |
|------|-------|-------|
| 41 | Hero croissants | Hardcoded Unsplash URL |
| 163 | Chef photo | Hardcoded Unsplash URL |
| 183 | Chef thumb "Fresh bread" | Hardcoded Unsplash URL |
| 186 | Chef thumb "Pastries" | Hardcoded Unsplash URL |
| 189 | Chef thumb "Cookies" | Hardcoded Unsplash URL |

### Hardcoded Local URLs
| Page | Path | Issue |
|------|------|-------|
| Login | /logo.jpg | Hardcoded local path |
| Register | /logo.jpg | Hardcoded local path |
| About | Unsplash URL | Hardcoded external URL |

### Image Fallbacks Added
- Added (error)="$any($event.target).style.display='none'" to all <img [src]> bindings
- Added CSS fallback pseudo-elements (.bakery-product-card__img-wrap::after, etc.) with "No image" text on #E5D3AF background
- Error handlers added to all bound images across all 16 templates

## Customer Feedback Database Issue

### Error Source
**File:** src/app/services/reviews.service.ts (lines 35-40)

### Supabase Query Causing Error
```typescript
this.db.client
  .from('reviews')
  .select('*, product:products(name, image_url)')
  .order('created_at', { ascending: false })
```

### Root Cause
The query uses an inline foreign-key join (product:products(name, image_url)) which requires a foreign-key relationship between reviews and products tables in the Supabase schema. If no FK relationship is defined in Supabase, PostgREST returns:
> "Could not find a relationship between 'reviews' and 'products' in the schema cache"

### Error Flow
1. reviewsService.list() runs the query with inline join
2. Supabase returns PostgREST error if FK missing
3. Error thrown -> caught in feedback.component.ts -> toErrorMessage(err) returns raw message
4. Template displays: (!) + "Could not load reviews" + {{ err }} (raw Supabase message)

### Proposed Fix (Database - NOT styling)
**Option A: Add Foreign Key (Recommended)**
```sql
ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_product 
FOREIGN KEY (product_id) REFERENCES products(id);
```

**Option B: Modify Query (if FK cannot be added)**
```typescript
// Two separate queries instead of inline join
const reviews = await this.db.client.from('reviews').select('*').order('created_at', { ascending: false });
const products = await this.db.client.from('products').select('id, name, image_url');
// Join in application code
```

> **Note:** This is a database/schema issue, NOT a styling issue. The error state is now styled nicely with a friendly icon and "Try again" button.

## Files Changed Summary

| Category | Count | Files |
|----------|-------|-------|
| Theme SCSS | 3 | _variables.scss, _page-shared.scss, _menu.scss |
| Page Templates | 16 | All page .html files |
| Component TS | 5 | menu, notifications, profile, admin, order-oversight |
| Component HTML | 3 | menu, notifications, profile |
| Config | 1 | index.html |
| **Total** | **28** | |

## Verification
- Build passes (ng build --configuration production)
- No old-palette hex values remain in templates (verified via grep)
- All 16 pages have menu button (login/register intentionally lack it)
- Image error handlers on all bound images
- Image fallbacks with CSS "No image" placeholders
- Emoji icons replaced with Ionicons (profile tabs, admin receipt, notifications)
- Full-width dashboard hero with max-width 1200px container
- Bread catalog grid uses repeat(auto-fill, minmax(230px, 1fr))
- Promotions hero has >=70% dark brown gradient overlay
- About hero has gradient overlay
- Order stat cards: #FFF4D6 cards with colored top borders
- Notifications: ionicon circles, bold titles, unread dots, "Read all" button
- Button visibility: 2px #4D2A00 border, 44px min-height, #4D2A00 text, 0 3px 0 shadow
- Light theme enforced (no dark mode)
- Inter font loaded via Google Fonts
- prefers-reduced-motion respected