-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_seed_demo_products.sql  (OPTIONAL)
-- A small starter catalog so the UI has data before you add your own.
-- Run it only if you want demo products; delete items from the Admin panel
-- or remove this script entirely if you prefer to start empty.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.products (id, name, category, description, price, rating, image_url)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Classic Sourdough',
    'Breads',
    'Stone-baked, chewy open crumb',
    185.00,
    4.9,
    'https://images.unsplash.com/photo-1585478259715-4d3064a3e247?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Butter Croissant',
    'Pastries',
    'Flaky layers, pure butter dough',
    95.00,
    4.8,
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Choco Fudge Cake',
    'Cakes',
    'Rich dark chocolate layers',
    320.00,
    5.0,
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Double Choco Cookie',
    'Cookies',
    'Gooey centre, crispy edge',
    75.00,
    4.7,
    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'Blueberry Muffin',
    'Muffins',
    'Bursting with fresh blueberries',
    95.00,
    4.8,
    'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Cinnamon Roll',
    'Pastries',
    'Soft swirls with cream cheese glaze',
    120.00,
    4.6,
    'https://images.unsplash.com/photo-1609342122563-a43ac8917a3a?w=400&h=400&fit=crop&auto=format'
  )
on conflict (id) do nothing;