# Mindset — website + moderated creator community

A responsive static website starter for an AI creator app and social community. It includes:
- Product landing page and AI tool showcase
- Community feed for approved posts
- Email/password sign-up and sign-in
- Photo/video upload from browser
- Pending-review workflow
- Admin approval/rejection dashboard
- Private media bucket and short-lived signed URLs
- Supabase SQL schema and Row Level Security (RLS)
- Android integration contract

## Important: what this starter does and does not do

This is a working front-end starter, but it is **not live until you create and configure your own Supabase project** and deploy the Edge Function. It does not include a working AI video generation engine. AI tools are currently product showcase/workflow entry points; connect Gemini or another provider separately. Never put Gemini secrets or Supabase service-role keys in browser or Android code.

## 1. Create a free Supabase project

1. Visit https://supabase.com and create a Free project.
2. Save the database password somewhere safe.
3. Open Project Settings → API.
4. Copy the Project URL and publishable/anon key.
5. In `src/main.js`, replace:
   - `SUPABASE_URL = ''`
   - `SUPABASE_ANON_KEY = ''`
   Use the publishable/anon key only. Never use `service_role`.

Supabase Free currently lists 500 MB database, 1 GB file storage, 50,000 monthly active users, and 5 GB egress. Free projects may pause after a week of inactivity. Check current limits before launch: https://supabase.com/pricing

## 2. Create database + private media storage

1. In Supabase Dashboard → SQL Editor → New query.
2. Paste all of `supabase/schema.sql`.
3. Run it.
4. Confirm Storage contains a **private** bucket named `community-media`.

The SQL installs policies so:
- Visitors can read only approved posts.
- Signed-in users can submit only their own posts with `status='pending'`.
- Only accounts with the trusted `app_metadata.role = 'admin'` can approve/reject.
- Users can upload only into their own UUID folder.
- Media is private; public viewing uses short-lived signed URLs from the Edge Function.

## 3. Deploy the media URL Edge Function

Install Supabase CLI and sign in:
https://supabase.com/docs/guides/cli

From this project folder:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy media-url
```

The function uses Supabase's server-side environment variables. Do not add a service-role key to `src/main.js`.

## 4. Create your administrator account

1. Sign up through your website once.
2. In Supabase Dashboard → Authentication → Users, copy your user UUID.
3. On your own computer, create a temporary environment with:
```bash
npm install @supabase/supabase-js
```
4. Run the admin setup script with your private service-role key:
```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_PRIVATE_SERVICE_ROLE_KEY" \
ADMIN_USER_ID="YOUR_AUTH_USER_UUID" \
node scripts/set-admin.mjs
```
5. Sign out and sign in again on the website.
6. Press `Alt + Shift + A` to open the admin review dashboard.

The service-role key is highly privileged. Never paste it into the website, Android app, GitHub, screenshots or public AI prompts. Delete it from shell history if you accidentally expose it.

## 5. Run the website locally

You need Node.js installed:
https://nodejs.org/

```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

Without Supabase credentials, the website displays a preview and the backend features remain disabled.

## 6. Deploy free with Cloudflare Pages

1. Create a GitHub account and a new **private** repository.
2. Upload this project (do not upload `.env` files or secrets).
3. Create a Cloudflare account: https://dash.cloudflare.com/
4. Open Workers & Pages → Create → Pages → Connect to Git.
5. Select your repository.
6. Framework preset: **Vite**
7. Build command: `npm run build`
8. Build output directory: `dist`
9. Deploy. Your site receives a `*.pages.dev` address.

Cloudflare Pages free limits: https://developers.cloudflare.com/pages/platform/limits/

## 7. Connect Android

Use the same Supabase project in your Android app. Read `android-example/README.md`. Both clients upload to the same private bucket and insert into the same `posts` table. The Android app must always submit `status='pending'`.

## 8. Security checklist before inviting users

- Enable email confirmation in Supabase Auth.
- Set allowed site URL and redirect URLs in Supabase Auth settings.
- Keep the `community-media` bucket private.
- Confirm RLS is enabled on `profiles` and `posts`.
- Confirm a normal user cannot update their post status.
- Confirm an unauthenticated visitor cannot read pending posts.
- Set a strong password and MFA on your Supabase owner account.
- Add report/block controls and a moderation policy before opening a public community.
- Add rate limits / anti-spam controls before broad launch.
- Set a content removal contact and privacy policy appropriate to your launch countries.
- Review file sizes and storage/egress quotas frequently.

## 9. Known MVP limitations

- The public feed is a simple chronological feed, not a recommendation algorithm.
- Share currently copies the post's URL. Social platforms decide how previews appear.
- Admin shortcut is `Alt + Shift + A`.
- The admin queue is intentionally not linked in public navigation.
- No comments, likes, DMs, push notifications, monetization or automated moderation yet.
- This starter is not a substitute for a security review before handling sensitive data or large traffic.
