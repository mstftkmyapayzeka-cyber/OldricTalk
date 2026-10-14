-- Cloudflare Realtime SFU oturumları: hangi SFU oturumu hangi kullanıcıya ve hangi
-- ses kanalına ait. Yalnızca cf-sfu Edge Function'ı (service role) okur/yazar;
-- istemciler doğrudan erişemez (RLS açık, politika yok).
create table public.voice_sessions (
  session_id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index voice_sessions_channel_idx on public.voice_sessions (channel_id);
create index voice_sessions_profile_idx on public.voice_sessions (profile_id);

alter table public.voice_sessions enable row level security;
