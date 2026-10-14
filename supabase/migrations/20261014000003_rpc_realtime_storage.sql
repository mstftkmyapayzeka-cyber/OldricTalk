-- İstemci RPC'leri, gerçek zamanlı yayın ve depolama.
-- İç yardımcılar ve tetikleyici fonksiyonları `private` şemasında: PostgREST bu şemayı
-- dışa açmaz, böylece keyfi argümanla çağrılıp bilgi sızdıramazlar.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Engel bilgisi yalnızca taraflardan biri soruyorsa döner (başkalarının engel
-- ilişkisi sorgulanamasın).
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (a, b) and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ================================================================ iç yardımcılar
create or replace function private.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;

create or replace function private.profile_snapshot(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'username', username,
                            'display_name', display_name, 'avatar_url', avatar_url)
  from public.profiles where id = p_id;
$$;

-- ================================================================ profil
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[a-z0-9_.]{2,32}$'
     and not exists (select 1 from public.profiles where username = p_username);
$$;

create or replace function public.heartbeat()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;

-- ================================================================ sunucular
create or replace function public.create_server(p_name text, p_icon_url text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  sid uuid;
  owned integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select count(*) into owned from public.servers where owner_id = me;
  if owned >= 25 then
    raise exception 'server_limit' using hint = 'En fazla 25 sunucu oluşturabilirsiniz.';
  end if;

  insert into public.servers (name, icon_url, owner_id)
  values (btrim(p_name), p_icon_url, me) returning id into sid;
  insert into public.members (server_id, profile_id, role) values (sid, me, 'admin');
  insert into public.channels (server_id, name, type, position) values
    (sid, 'genel', 'text', 0),
    (sid, 'Genel', 'voice', 1);
  return sid;
end;
$$;

-- Davet önizlemesi: üye olmayan da görebilir (ad, simge, üye sayısı).
create or replace function public.invite_preview(p_code text)
returns table (server_id uuid, name text, icon_url text, member_count bigint, is_member boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.icon_url,
         (select count(*) from public.members m where m.server_id = s.id),
         exists (select 1 from public.members m
                 where m.server_id = s.id and m.profile_id = auth.uid())
  from public.servers s where s.invite_code = p_code and auth.uid() is not null;
$$;

create or replace function public.join_server(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  sid uuid;
  joined integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into sid from public.servers where invite_code = p_code;
  if sid is null then raise exception 'invalid_invite' using hint = 'Davet geçersiz ya da süresi dolmuş.'; end if;
  if exists (select 1 from public.server_bans where server_id = sid and profile_id = me) then
    raise exception 'banned' using hint = 'Bu sunucudan yasaklandınız.';
  end if;
  select count(*) into joined from public.members where profile_id = me;
  if joined >= 100 and not exists (
    select 1 from public.members where server_id = sid and profile_id = me) then
    raise exception 'join_limit' using hint = 'En fazla 100 sunucuya katılabilirsiniz.';
  end if;
  insert into public.members (server_id, profile_id) values (sid, me)
  on conflict (server_id, profile_id) do nothing;
  return sid;
end;
$$;

create or replace function public.regenerate_invite(p_server uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  if not public.is_moderator(p_server) then raise exception 'forbidden'; end if;
  code := encode(extensions.gen_random_bytes(6), 'hex');
  update public.servers set invite_code = code where id = p_server;
  return code;
end;
$$;

-- Rol değiştirme: yalnızca admin; sahibin rolü değişmez.
create or replace function public.set_member_role(p_member uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member;
  if m.id is null or public.my_role(m.server_id) is distinct from 'admin' then
    raise exception 'forbidden';
  end if;
  if exists (select 1 from public.servers where id = m.server_id and owner_id = m.profile_id) then
    raise exception 'cannot_change_owner';
  end if;
  update public.members set role = p_role where id = p_member;
end;
$$;

create or replace function public.set_nickname(p_server uuid, p_nickname text)
returns void language sql security definer set search_path = '' as $$
  update public.members set nickname = nullif(btrim(p_nickname), '')
  where server_id = p_server and profile_id = auth.uid();
$$;

-- Mesaj silme (yumuşak): yazar ya da sunucu moderatörü. messages_guard içeriği temizler.
create or replace function public.delete_message(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  msg public.messages;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into msg from public.messages where id = p_message;
  if msg.id is null then raise exception 'not_found'; end if;
  if msg.author_id is distinct from auth.uid()
     and not public.is_moderator(public.channel_server(msg.channel_id)) then
    raise exception 'forbidden';
  end if;
  update public.messages set deleted = true where id = p_message;
end;
$$;

create or replace function public.delete_direct_message(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.direct_messages set deleted = true
  where id = p_message and author_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- ================================================================ arkadaşlık
create or replace function public.send_friend_request(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target uuid;
  existing public.friendships;
  pending integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into target from public.profiles where username = lower(btrim(p_username));
  if target is null then raise exception 'user_not_found' using hint = 'Bu kullanıcı adı bulunamadı.'; end if;
  if target = me then raise exception 'self' using hint = 'Kendinizi ekleyemezsiniz.'; end if;
  if public.is_blocked_between(me, target) then
    raise exception 'blocked' using hint = 'Bu kullanıcıya istek gönderilemiyor.';
  end if;

  select * into existing from public.friendships
  where least(requester_id, addressee_id) = least(me, target)
    and greatest(requester_id, addressee_id) = greatest(me, target);

  if existing.requester_id is not null then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.addressee_id = me then
      -- Karşı taraf zaten istek göndermiş: kabul et.
      update public.friendships set status = 'accepted'
      where requester_id = existing.requester_id and addressee_id = me;
      return 'accepted';
    end if;
    return 'already_pending';
  end if;

  select count(*) into pending from public.friendships
  where requester_id = me and status = 'pending';
  if pending >= 100 then
    raise exception 'request_limit' using hint = 'Bekleyen istek sınırına ulaştınız.';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, target);
  return 'sent';
end;
$$;

create or replace function public.accept_friend_request(p_requester uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.friendships set status = 'accepted'
  where requester_id = p_requester and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.block_user(p_other uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_other = auth.uid() then raise exception 'self'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_other)
  on conflict do nothing;
  -- Arkadaşlık kaydı da kaldırılır (private.drop_friendship, 0004'te).
  perform private.drop_friendship(auth.uid(), p_other);
end;
$$;

-- ================================================================ DM
-- DM açılabilir: arkadaşsanız ya da ortak bir sunucudaysanız, ve engel yoksa.
create or replace function public.open_dm(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other = me then raise exception 'self'; end if;

  select a.conversation_id into cid
  from public.conversation_participants a
  join public.conversation_participants b
    on b.conversation_id = a.conversation_id and b.profile_id = p_other
  where a.profile_id = me
    and (select count(*) from public.conversation_participants c
         where c.conversation_id = a.conversation_id) = 2
  limit 1;
  if cid is not null then return cid; end if;

  if public.is_blocked_between(me, p_other) then
    raise exception 'blocked' using hint = 'Bu kullanıcıya mesaj gönderilemiyor.';
  end if;
  if not private.are_friends(me, p_other) and not exists (
    select 1 from public.members m1
    join public.members m2 on m2.server_id = m1.server_id and m2.profile_id = p_other
    where m1.profile_id = me) then
    raise exception 'not_allowed'
      using hint = 'Yalnızca arkadaşlarınıza ya da ortak sunucudaki kişilere mesaj atabilirsiniz.';
  end if;

  insert into public.conversations default values returning id into cid;
  insert into public.conversation_participants (conversation_id, profile_id)
  values (cid, me), (cid, p_other);
  return cid;
end;
$$;

-- ================================================================ gerçek zamanlı
-- Konu adları:
--   server:<id>  → sunucu üyeleri: kanal mesajları, yapı olayları, yazıyor göstergesi
--   user:<id>    → yalnızca kişinin kendisi: DM mesajları, arkadaşlık, üyelik değişikliği
--   dm:<id>      → konuşma katılımcıları: yazıyor göstergesi
create or replace function private.can_access_topic(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := split_part(p_topic, ':', 1);
  ident uuid;
begin
  begin
    ident := split_part(p_topic, ':', 2)::uuid;
  exception when others then
    return false;
  end;
  return case kind
    when 'server' then public.is_member(ident)
    when 'user' then ident = auth.uid()
    when 'dm' then public.is_participant(ident)
    else false
  end;
end;
$$;

create policy realtime_receive on realtime.messages for select to authenticated
  using (private.can_access_topic((select realtime.topic())));
-- İstemciler yalnızca yazıyor göstergesi gönderir (sunucu ve dm konularına).
create policy realtime_send on realtime.messages for insert to authenticated
  with check (
    split_part((select realtime.topic()), ':', 1) in ('server', 'dm')
    and private.can_access_topic((select realtime.topic()))
  );

create or replace function private.broadcast_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  payload jsonb;
  ev text := case tg_op when 'INSERT' then 'message_created' else 'message_updated' end;
  p record;
begin
  payload := to_jsonb(new) || jsonb_build_object('author', private.profile_snapshot(new.author_id));
  if tg_table_name = 'messages' then
    perform realtime.send(payload, ev, 'server:' || public.channel_server(new.channel_id), true);
  else
    for p in select profile_id from public.conversation_participants
             where conversation_id = new.conversation_id loop
      perform realtime.send(payload, 'dm_' || ev, 'user:' || p.profile_id, true);
    end loop;
  end if;
  return null;
end;
$$;
create trigger messages_broadcast after insert or update on public.messages
  for each row execute function private.broadcast_message();
create trigger direct_messages_broadcast after insert or update on public.direct_messages
  for each row execute function private.broadcast_message();

-- Yapısal değişiklikler: istemci ilgili sorguyu tazeler.
create or replace function private.broadcast_structure()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  sid uuid;
  payload jsonb;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_table_name = 'servers' then
    sid := r.id;
  else
    sid := r.server_id;
  end if;
  payload := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', r.id, 'server_id', sid);
  perform realtime.send(payload, 'structure_changed', 'server:' || sid, true);
  if tg_table_name = 'members' then
    -- Kişinin kendi sunucu listesi değişti (katıldı / atıldı).
    perform realtime.send(payload, 'membership_changed', 'user:' || r.profile_id, true);
  end if;
  return null;
end;
$$;
create trigger servers_broadcast after update or delete on public.servers
  for each row execute function private.broadcast_structure();
create trigger channels_broadcast after insert or update or delete on public.channels
  for each row execute function private.broadcast_structure();
create trigger members_broadcast after insert or update or delete on public.members
  for each row execute function private.broadcast_structure();

create or replace function private.broadcast_friendship()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  payload jsonb;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  payload := jsonb_build_object('op', tg_op, 'requester_id', r.requester_id,
                                'addressee_id', r.addressee_id, 'status', r.status);
  perform realtime.send(payload, 'friendship_changed', 'user:' || r.requester_id, true);
  perform realtime.send(payload, 'friendship_changed', 'user:' || r.addressee_id, true);
  return null;
end;
$$;
create trigger friendships_broadcast after insert or update or delete on public.friendships
  for each row execute function private.broadcast_friendship();

-- Yeni DM konuşması karşı tarafın listesinde belirsin.
create or replace function private.broadcast_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('conversation_id', new.conversation_id),
                        'conversation_added', 'user:' || new.profile_id, true);
  return null;
end;
$$;
create trigger conversation_participants_broadcast after insert on public.conversation_participants
  for each row execute function private.broadcast_conversation();

-- ================================================================ depolama
-- avatars: profil/sunucu resimleri (2 MB, resim). attachments: mesaj ekleri (10 MB).
-- Yollar <kullanıcı-id>/... ile başlamalı; herkes yalnızca kendi klasörüne yazar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152,
   array['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('attachments', 'attachments', true, 10485760, null)
on conflict (id) do nothing;

create policy storage_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'attachments')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
