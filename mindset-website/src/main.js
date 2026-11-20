import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = ''; // Add your project URL from Supabase > Project Settings > API
const SUPABASE_ANON_KEY = ''; // Add your publishable/anon key. NEVER put a service_role key here.
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
const authDialog = $('authDialog'), postDialog = $('postDialog'), adminDialog = $('adminDialog');
let authMode = 'login';
let currentUser = null;
let currentFilter = 'all';
let cachedPosts = [];

$('year').textContent = new Date().getFullYear();

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  window.setTimeout(() => el.classList.remove('show'), 3200);
}
function showSetupHint() {
  toast('Connect your Supabase project first. See README.md.');
}
function isConfigured() { return Boolean(supabase); }
function fileKind(file) { return file.type.startsWith('video/') ? 'video' : 'image'; }
function safeText(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function openAuth(mode='login') {
  authMode = mode; $('authTitle').textContent = mode === 'login' ? 'Welcome to Mindset' : 'Create your creator account';
  $('authSubtitle').textContent = mode === 'login' ? 'Sign in to publish and manage your posts.' : 'Join the community. Your first post will be reviewed.';
  $('authSubmit').textContent = mode === 'login' ? 'Log in' : 'Create account';
  $('displayNameWrap').classList.toggle('hidden', mode === 'login');
  $('authModeToggle').textContent = mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in';
  $('authMessage').textContent = ''; authDialog.showModal();
}
$('loginBtn').addEventListener('click', () => openAuth('login'));
$('joinBtn').addEventListener('click', () => openAuth('signup'));
$('authModeToggle').addEventListener('click', () => openAuth(authMode === 'login' ? 'signup' : 'login'));
$('createPostBtn').addEventListener('click', () => {
  if (!isConfigured()) return showSetupHint();
  if (!currentUser) return openAuth('login');
  $('postMessage').textContent = ''; postDialog.showModal();
});

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isConfigured()) return showSetupHint();
  const email = $('authEmail').value.trim(), password = $('authPassword').value;
  const button = $('authSubmit'); button.disabled = true; button.textContent = 'Please wait…';
  try {
    let result;
    if (authMode === 'signup') {
      result = await supabase.auth.signUp({ email, password, options: { data: { display_name: $('displayName').value.trim() || email.split('@')[0] } } });
      if (!result.error) $('authMessage').textContent = 'Account created. Check your email if confirmation is enabled, then sign in.';
    } else result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (authMode === 'login' && result.data.user) { authDialog.close(); toast('You are signed in.'); }
    await refreshSession();
  } catch (error) { $('authMessage').textContent = error.message || 'Could not sign in.'; }
  finally { button.disabled = false; button.textContent = authMode === 'login' ? 'Log in' : 'Create account'; }
});

async function refreshSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  $('loginBtn').textContent = currentUser ? 'Account' : 'Log in';
  $('joinBtn').textContent = currentUser ? 'Sign out' : 'Join Mindset ↗';
  $('joinBtn').onclick = currentUser ? async () => { await supabase.auth.signOut(); currentUser = null; refreshSession(); toast('Signed out.'); } : () => openAuth('signup');
  if (currentUser) {
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', currentUser.id).maybeSingle();
    if (profile?.display_name) $('loginBtn').textContent = profile.display_name.slice(0, 14);
  }
}
if (supabase) {
  supabase.auth.onAuthStateChange(() => { refreshSession(); });
  refreshSession();
}

$('postForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase || !currentUser) return openAuth('login');
  const file = $('postFile').files[0], caption = $('postCaption').value.trim();
  if (!file) return;
  const allowed = ['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
  if (!allowed.includes(file.type)) return $('postMessage').textContent = 'Choose a JPG, PNG, WebP, MP4 or WebM file.';
  if (file.size > 50 * 1024 * 1024) return $('postMessage').textContent = 'This file is larger than 50 MB.';
  const button = $('publishBtn'); button.disabled = true; button.textContent = 'Uploading…';
  try {
    const postId = crypto.randomUUID();
    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'') || 'bin';
    const path = `${currentUser.id}/${postId}/media.${extension}`;
    const upload = await supabase.storage.from('community-media').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    const insert = await supabase.from('posts').insert({
      id: postId, user_id: currentUser.id, caption, media_path: path,
      media_type: fileKind(file), status: 'pending'
    });
    if (insert.error) {
      await supabase.storage.from('community-media').remove([path]);
      throw insert.error;
    }
    $('postForm').reset(); postDialog.close(); toast('Submitted! Your post is waiting for admin approval.');
  } catch (error) { $('postMessage').textContent = error.message || 'Upload failed. Please try again.'; }
  finally { button.disabled = false; button.textContent = 'Submit for review'; }
});

async function getMediaUrl(postId) {
  const { data, error } = await supabase.functions.invoke('media-url', { body: { postId } });
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Media is not available.');
  return data.signedUrl;
}
async function loadFeed() {
  const grid = $('feedGrid');
  if (!supabase) {
    $('feedStatus').textContent = 'Preview mode · connect Supabase to activate';
    grid.innerHTML = `<article class="post-skeleton"><div></div><span>Connect Supabase to show approved community posts.</span></article><article class="post-skeleton"><div></div><span>New submissions stay private until approved.</span></article><article class="post-skeleton"><div></div><span>Launch your creator community here.</span></article>`;
    return;
  }
  $('feedStatus').textContent = 'Loading approved posts…';
  const query = supabase.from('posts').select('id,caption,media_type,created_at,user_id').eq('status','approved').order('created_at',{ascending:false}).limit(30);
  const { data, error } = await query;
  if (error) { $('feedStatus').textContent = 'Could not load posts'; grid.innerHTML = `<p class="muted">${safeText(error.message)}</p>`; return; }
  cachedPosts = data || []; renderFeed();
}
async function renderFeed() {
  const grid = $('feedGrid');
  const posts = cachedPosts.filter(p => currentFilter === 'all' || p.media_type === currentFilter);
  if (!posts.length) { grid.innerHTML = '<p class="muted">No approved posts here yet. Be the first to share something.</p>'; $('feedStatus').textContent = 'No posts yet'; return; }
  $('feedStatus').textContent = `${posts.length} approved ${posts.length === 1 ? 'post' : 'posts'}`;
  grid.innerHTML = posts.map(p => `<article class="post-card" data-post="${p.id}"><div class="post-media media-loading">Loading media…</div><div class="post-body"><div class="post-caption">${safeText(p.caption)}</div><div class="post-meta"><span>${new Date(p.created_at).toLocaleDateString()}</span><button class="post-share" data-share="${p.id}">Share ↗</button></div></div></article>`).join('');
  for (const p of posts) {
    try {
      const url = await getMediaUrl(p.id);
      const card = grid.querySelector(`[data-post="${p.id}"] .post-media`);
      if (!card) continue;
      const media = p.media_type === 'video'
        ? Object.assign(document.createElement('video'), { src:url, controls:true, playsInline:true, className:'post-media' })
        : Object.assign(document.createElement('img'), { src:url, alt:'Community creation', className:'post-media', loading:'lazy' });
      card.replaceWith(media);
    } catch (e) {
      const card = grid.querySelector(`[data-post="${p.id}"] .post-media`);
      if (card) card.textContent = 'Media unavailable';
    }
  }
}
$('feedGrid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-share]');
  if (!button) return;
  const url = `${location.origin}${location.pathname}#post-${button.dataset.share}`;
  try { await navigator.clipboard.writeText(url); toast('Post link copied.'); }
  catch { toast(url); }
});
document.querySelectorAll('.feed-tabs button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.feed-tabs button').forEach(b => b.classList.remove('active'));
  button.classList.add('active'); currentFilter = button.dataset.filter; renderFeed();
}));

async function loadAdminQueue() {
  const container = $('adminQueue');
  if (!supabase || !currentUser) { container.innerHTML = '<p class="muted">Sign in with your admin account first.</p>'; return; }
  const { data, error } = await supabase.from('posts').select('id,caption,media_type,media_path,created_at,user_id').eq('status','pending').order('created_at',{ascending:true}).limit(50);
  if (error) { container.innerHTML = `<p class="muted">${safeText(error.message)}. Confirm your account has the admin role.</p>`; return; }
  if (!data.length) { container.innerHTML = '<p class="muted">The review queue is empty.</p>'; return; }
  container.innerHTML = data.map(p => `<article class="admin-item" data-admin-post="${p.id}"><p>${safeText(p.caption)}</p><div class="muted">${new Date(p.created_at).toLocaleString()}</div><div class="admin-preview">Loading preview…</div><div class="admin-buttons"><button class="btn btn-approve" data-approve="${p.id}">Approve</button><button class="btn btn-reject" data-reject="${p.id}">Reject</button></div></article>`).join('');
  for (const p of data) {
    try {
      const { data: signed } = await supabase.storage.from('community-media').createSignedUrl(p.media_path, 300);
      const preview = container.querySelector(`[data-admin-post="${p.id}"] .admin-preview`);
      if (preview && signed?.signedUrl) preview.innerHTML = p.media_type === 'video' ? `<video src="${signed.signedUrl}" controls></video>` : `<img src="${signed.signedUrl}" alt="Pending submission">`;
    } catch {}
  }
}
$('adminQueue').addEventListener('click', async (event) => {
  const approve = event.target.closest('[data-approve]'), reject = event.target.closest('[data-reject]');
  const id = approve?.dataset.approve || reject?.dataset.reject;
  if (!id) return;
  const status = approve ? 'approved' : 'rejected';
  const { error } = await supabase.from('posts').update({status}).eq('id',id);
  if (error) return toast(`Action failed: ${error.message}`);
  toast(status === 'approved' ? 'Post approved and now public.' : 'Post rejected.');
  await loadAdminQueue(); await loadFeed();
});

const hash = location.hash;
if (hash.startsWith('#post-')) {
  // Public post URLs use the same feed; scrolling is handled after the feed loads.
  loadFeed().then(() => document.querySelector(`[data-post="${hash.slice(6)}"]`)?.scrollIntoView({behavior:'smooth'}));
} else loadFeed();

$('mobileMenu').addEventListener('click', () => {
  const nav = document.querySelector('.desktop-nav');
  nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
  nav.style.position = 'absolute'; nav.style.top = '68px'; nav.style.left = '0'; nav.style.right = '0';
  nav.style.padding = '20px'; nav.style.background = '#171426'; nav.style.flexDirection = 'column';
});
window.addEventListener('keydown', (event) => {
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'a') {
    if (!currentUser) return openAuth('login');
    adminDialog.showModal(); loadAdminQueue();
  }
});
