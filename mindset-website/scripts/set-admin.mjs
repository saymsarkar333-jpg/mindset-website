// Run locally once to grant admin role to your own Supabase account.
// 1) npm install @supabase/supabase-js
// 2) SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_USER_ID=... node scripts/set-admin.mjs
// Keep the service role key private. Never put it in frontend or Android code.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.ADMIN_USER_ID;
if (!url || !serviceKey || !userId) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or ADMIN_USER_ID.');
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.getUserById(userId);
if (error || !data.user) throw error || new Error('User not found');
const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
  app_metadata: { ...(data.user.app_metadata || {}), role: 'admin' }
});
if (updateError) throw updateError;
console.log(`Admin role granted to ${data.user.email || userId}. Sign out and sign in again.`);
