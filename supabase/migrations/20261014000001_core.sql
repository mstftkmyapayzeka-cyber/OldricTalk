-- OldricTalk çekirdek şema: profiller, sunucular, üyeler, kanallar, mesajlar,
-- DM'ler, arkadaşlık, engelleme, okunma durumları.
-- Kural: istemci tablolara yalnızca RLS izin verdiği ölçüde dokunur; rol gerektiren
-- işlemler security definer RPC'lerden geçer.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tipler
create type public.member_role as enum ('admin', 'moderator', 'guest');
create type public.channel_type as enum ('text', 'voice');
create type public.user_status as enum ('online', 'idle', 'dnd', 'invisible');
create type public.friendship_status as enum ('pending', 'accepted');

-- ---------------------------------------------------------------- profiller
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_.]{2,32}$'),
  display_name text not null
    check (char_length(display_name) between 1 and 32),
  avatar_url text,
  status public.user_status not null default 'online',
  custom_status text check (char_length(custom_status) <= 128),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- sunucular
create table public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  icon_url text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique
    default encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);
create index servers_owner_idx on public.servers (owner_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'guest',
  nickname text check (char_length(nickname) <= 32),
  joined_at timestamptz not null default now(),
  unique (server_id, profile_id)
);
create index members_profile_idx on public.members (profile_id);

create table public.server_bans (
  server_id uuid not null references public.servers (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  banned_by uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 512),
  created_at timestamptz not null default now(),
  primary key (server_id, profile_id)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null check (name ~ '^[^\s#@][^#@]{0,99}$'),
  type public.channel_type not null default 'text',
  topic text check (char_length(topic) <= 1024),
  position integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index channels_server_idx on public.channels (server_id, position);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 4000),
  file_url text,
  file_name text check (char_length(file_name) <= 255),
  file_type text check (char_length(file_type) <= 127),
  edited_at timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  check (deleted or char_length(btrim(content)) > 0 or file_url is not null)
);
create index messages_channel_created_idx on public.messages (channel_id, created_at desc);
create index messages_author_created_idx on public.messages (author_id, created_at desc);

-- ---------------------------------------------------------------- DM
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, profile_id)
);
create index conversation_participants_profile_idx
  on public.conversation_participants (profile_id);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 4000),
  file_url text,
  file_name text check (char_length(file_name) <= 255),
  file_type text check (char_length(file_type) <= 127),
  edited_at timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  check (deleted or char_length(btrim(content)) > 0 or file_url is not null)
);
create index direct_messages_conv_created_idx
  on public.direct_messages (conversation_id, created_at desc);
create index direct_messages_author_created_idx
  on public.direct_messages (author_id, created_at desc);

-- ---------------------------------------------------------------- arkadaşlık
create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
-- Aynı çift için tek kayıt (yön fark etmeksizin).
create unique index friendships_pair_idx on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------- okunma
-- target_id: kanal ya da konuşma kimliği.
create table public.read_states (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (profile_id, target_id)
);

-- ================================================================ yardımcılar
create or replace function public.is_member(p_server uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
    where server_id = p_server and profile_id = (select auth.uid())
  );
$$;

create or replace function public.my_role(p_server uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select role from public.members
  where server_id = p_server and profile_id = (select auth.uid());
$$;

create or replace function public.is_moderator(p_server uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role(p_server) in ('admin', 'moderator'), false);
$$;

create or replace function public.channel_server(p_channel uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select server_id from public.channels where id = p_channel;
$$;

create or replace function public.is_participant(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and profile_id = (select auth.uid())
  );
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ================================================================ RLS
alter table public.profiles enable row level security;
alter table public.servers enable row level security;
alter table public.members enable row level security;
alter table public.server_bans enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.direct_messages enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.read_states enable row level security;

-- profiller: oturum açmış herkes okuyabilir; yalnızca kendi profilini günceller.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- sunucular: üyeler görür; yalnızca admin günceller. Oluşturma/silme RPC ile.
create policy servers_select on public.servers for select to authenticated
  using (public.is_member(id));
create policy servers_update on public.servers for update to authenticated
  using (public.my_role(id) = 'admin') with check (public.my_role(id) = 'admin');

-- üyeler: aynı sunucudakiler görür; kendi takma adını değiştirebilir. Rol/atma RPC ile.
create policy members_select on public.members for select to authenticated
  using (public.is_member(server_id));

create policy server_bans_select on public.server_bans for select to authenticated
  using (public.is_moderator(server_id));

-- kanallar: üyeler görür; moderatörler yönetir.
create policy channels_select on public.channels for select to authenticated
  using (public.is_member(server_id));
create policy channels_insert on public.channels for insert to authenticated
  with check (public.is_moderator(server_id));
create policy channels_update on public.channels for update to authenticated
  using (public.is_moderator(server_id)) with check (public.is_moderator(server_id));
create policy channels_delete on public.channels for delete to authenticated
  using (public.is_moderator(server_id));

-- mesajlar: üyeler okur; metin kanalına üye kendi adına yazar; yazar düzenler.
-- Silme (yumuşak) RPC ile — moderatörler başkalarınınkini de silebilir.
create policy messages_select on public.messages for select to authenticated
  using (public.is_member(public.channel_server(channel_id)));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and not deleted
    and edited_at is null
    and public.is_member(public.channel_server(channel_id))
    and exists (select 1 from public.channels c where c.id = channel_id and c.type = 'text')
  );
create policy messages_update on public.messages for update to authenticated
  using (author_id = (select auth.uid()) and not deleted)
  with check (author_id = (select auth.uid()));

-- DM'ler
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_participant(id));
create policy conversation_participants_select on public.conversation_participants
  for select to authenticated using (public.is_participant(conversation_id));

create policy direct_messages_select on public.direct_messages for select to authenticated
  using (public.is_participant(conversation_id));
create policy direct_messages_insert on public.direct_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and not deleted
    and edited_at is null
    and public.is_participant(conversation_id)
    -- Engellenmiş biriyle olan konuşmaya yazılamaz.
    and not exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = direct_messages.conversation_id
        and p.profile_id <> (select auth.uid())
        and public.is_blocked_between(p.profile_id, (select auth.uid()))
    )
  );
create policy direct_messages_update on public.direct_messages for update to authenticated
  using (author_id = (select auth.uid()) and not deleted)
  with check (author_id = (select auth.uid()));

-- arkadaşlık / engelleme: taraflar görür; değişiklikler RPC ile.
create policy friendships_select on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy blocks_select on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

-- okunma durumları: yalnızca kendisi.
create policy read_states_all on public.read_states for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- ================================================================ tetikleyiciler
-- Yeni kullanıcı → profil. Kullanıcı adı alınmışsa sonuna rakam eklenir.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  base text;
  candidate text;
  n integer := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    '[^a-zA-Z0-9_.]', '', 'g'));
  base := left(base, 28);
  if char_length(base) < 2 then
    base := 'kullanici';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || (floor(random() * 9000) + 1000)::int::text;
    if n > 20 then
      candidate := 'u' || replace(new.id::text, '-', '');
      candidate := left(candidate, 32);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), candidate), 32)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profilde kimlik ve kullanıcı adı dışındaki sütunlar serbest; last_seen RPC ile.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if new.username <> old.username then
    new.username := lower(new.username);
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Mesaj düzenlemede yalnızca içerik değişebilir; düzenleme zamanı damgalanır.
create or replace function public.messages_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.deleted and not old.deleted then
      -- RPC'den gelen silme: içerik ve dosya temizlenir.
      new.content := '';
      new.file_url := null;
      new.file_name := null;
      new.file_type := null;
      return new;
    end if;
    if new.content is distinct from old.content then
      new.edited_at := now();
    end if;
    new.id := old.id;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    new.file_url := old.file_url;
    new.file_name := old.file_name;
    new.file_type := old.file_type;
    new.deleted := old.deleted;
    if tg_table_name = 'messages' then
      new.channel_id := old.channel_id;
    else
      new.conversation_id := old.conversation_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger messages_guard before update on public.messages
  for each row execute function public.messages_guard();
create trigger direct_messages_guard before update on public.direct_messages
  for each row execute function public.messages_guard();

-- Hız sınırı: 5 saniyede en fazla 5 mesaj (kanal + DM toplamı).
create or replace function public.rate_limit_messages()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recent integer;
begin
  new.created_at := now();
  select
    (select count(*) from public.messages
       where author_id = new.author_id and created_at > now() - interval '5 seconds')
  + (select count(*) from public.direct_messages
       where author_id = new.author_id and created_at > now() - interval '5 seconds')
  into recent;
  if recent >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001',
      hint = 'Çok hızlı mesaj gönderiyorsunuz.';
  end if;
  return new;
end;
$$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.rate_limit_messages();
create trigger direct_messages_rate_limit before insert on public.direct_messages
  for each row execute function public.rate_limit_messages();

-- last_message_at güncellemesi.
create or replace function public.touch_last_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'messages' then
    update public.channels set last_message_at = new.created_at where id = new.channel_id;
  else
    update public.conversations set last_message_at = new.created_at
      where id = new.conversation_id;
  end if;
  return null;
end;
$$;
create trigger messages_touch after insert on public.messages
  for each row execute function public.touch_last_message();
create trigger direct_messages_touch after insert on public.direct_messages
  for each row execute function public.touch_last_message();
