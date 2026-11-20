# Connect your Android app to Mindset

Use the **same Supabase project** as the website. This makes posts submitted by Android appear in the website review queue and, after approval, in the public feed.

## Add Supabase Kotlin SDK

Follow the current official Kotlin SDK setup because dependency versions can change:
https://supabase.com/docs/reference/kotlin/installing

Use the Supabase Auth, PostgREST and Storage modules. Add your Supabase project URL and publishable/anon key to Android local configuration (not the service-role key).

## Shared post contract

The website expects:
- Table: `public.posts`
- `id`: UUID
- `user_id`: authenticated Supabase user UUID
- `caption`: up to 1,200 characters
- `media_path`: `USER_UUID/POST_UUID/media.ext`
- `media_type`: `image` or `video`
- `status`: always `pending` on user submission

## Android upload sequence

1. Sign the user in with Supabase Auth.
2. Generate a UUID for the post.
3. Upload media to the private `community-media` bucket at:
   `"$userId/$postId/media.$extension"`
4. Insert the post row into `public.posts` with `status = "pending"`.
5. Display “Submitted for review”.
6. Do not attempt to set `status = "approved"` from the app. RLS rejects it.
7. To show public media, call the `media-url` Edge Function with `{ "postId": "..." }`. It returns a short-lived signed URL only for approved posts.

## Kotlin-shaped example (adapt to the SDK version you install)

```kotlin
// Pseudocode: names may differ slightly by supabase-kt release.
val userId = supabase.auth.currentUserOrNull()?.id
    ?: error("User must sign in")

val postId = UUID.randomUUID().toString()
val path = "$userId/$postId/media.jpg"

// 1. Upload selected bytes to Storage bucket "community-media" at `path`.
// 2. Insert into public.posts:
//    id = postId
//    user_id = userId
//    caption = caption
//    media_path = path
//    media_type = "image"
//    status = "pending"

```

Official Kotlin SDK:
https://github.com/supabase-community/supabase-kt
