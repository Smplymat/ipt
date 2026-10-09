// Supabase Database Connection Test Script
// Run with: node scripts/test-db-connection.js
// Requires: SUPABASE_URL and SUPABASE_ANON_KEY environment variables
// or create a .env file with those values

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env if exists
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vbrbtajunsewqysqpfck.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_1389AZvIrMi9rOP8d5mXAQ_3PLOY1B8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tables = [
  'products',
  'cart_items',
  'orders',
  'order_items',
  'vouchers',
  'user_vouchers',
  'notifications',
  'profiles',
  'user_roles',
  'categories',
  'reviews',
  'addresses',
  'custom_orders',
  'newsletter_subscribers',
];

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log('');

  // Test 1: Basic REST endpoint reachability
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);
    if (error) throw error;
    console.log('✅ REST API reachable');
  } catch (err) {
    console.log('❌ REST API unreachable:', err.message);
    return;
  }

  // Test 2: Auth session (requires valid user)
  console.log('');
  console.log('🔐 Testing Auth...');
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (session) {
      console.log('✅ Auth session valid (user:', session.user.email, ')');
    } else {
      console.log('⚠️ No active auth session (need to sign in for user-scoped tests)');
    }
  } catch (err) {
    console.log('❌ Auth error:', err.message);
  }

  // Test 3: Table queries
  console.log('');
  console.log('📊 Testing Table Access...');
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message} (code: ${error.code})`);
      } else {
        console.log(`✅ ${table}: accessible (${count ?? 'unknown'} rows)`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  // Test 4: RPC function
  console.log('');
  console.log('⚙️ Testing RPC Functions...');
  try {
    const { data, error } = await supabase.rpc('place_order', {
      p_customer_name: 'Test',
      p_phone: '09171234567',
      p_fulfillment_type: 'delivery',
      p_address: 'Test Address',
      p_unit_notes: '',
      p_latitude: 14.6,
      p_longitude: 121.0,
      p_scheduled_at: null,
      p_payment_method: 'cod',
      p_cart: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
      p_promo_code: null,
    });
    // This should fail with "unknown product" but the RPC should be callable
    if (error && error.message.includes('unknown product')) {
      console.log('✅ place_order RPC callable (returns expected error)');
    } else if (error) {
      console.log(`⚠️ place_order RPC error: ${error.message}`);
    } else {
      console.log('✅ place_order RPC callable');
    }
  } catch (err) {
    console.log('❌ place_order RPC not callable:', err.message);
  }

  // Test 5: Edge Functions
  console.log('');
  console.log('🌐 Testing Edge Functions...');
  const functions = ['create-payment', 'paymongo-webhook'];
  for (const fn of functions) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'OPTIONS',
      });
      if (response.ok) {
        console.log(`✅ ${fn}: reachable`);
      } else {
        console.log(`❌ ${fn}: HTTP ${response.status}`);
      }
    } catch (err) {
      console.log(`❌ ${fn}: ${err.message}`);
    }
  }

  console.log('');
  console.log('🏁 Connection test complete');
}

// Run the test
testConnection().catch(console.error);