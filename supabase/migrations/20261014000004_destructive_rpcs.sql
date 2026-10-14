-- Satır silen RPC'ler ve yetki sıkılaştırması.
-- (MCP aracı DELETE/REVOKE içeren migration'ları onaysız uygulayamadığı için ayrı dosya;
-- Supabase SQL Editor'den çalıştırılır.)

create or replace function private.drop_friendship(a uuid, b uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.friendships
  where least(requester_id, addressee_id) = least(a, b)
    and greatest(requester_id, addressee_id) = greatest(a, b);
$$;

create or replace function public.delete_server(p_server uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.servers where id = p_server and owner_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  delete from public.servers where id = p_server;
end;
$$;

create or replace function public.leave_server(p_server uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.servers where id = p_server and owner_id = auth.uid()) then
    raise exception 'owner_cannot_leave'
      using hint = 'Sunucu sahibi ayrılamaz; sunucuyu silebilir.';
  end if;
  delete from public.members where server_id = p_server and profile_id = auth.uid();
end;
$$;

-- Atma / yasaklama: admin herkesi (sahip hariç), moderatör yalnızca misafirleri.
create or replace function public.kick_member(p_member uuid, p_ban boolean default false,
                                              p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
  my public.member_role;
begin
  select * into m from public.members where id = p_member;
  if m.id is null then raise exception 'not_found'; end if;
  my := public.my_role(m.server_id);
  if my is null or my = 'guest' or m.profile_id = auth.uid()
     or (my = 'moderator' and m.role <> 'guest')
     or exists (select 1 from public.servers where id = m.server_id and owner_id = m.profile_id) then
    raise exception 'forbidden';
  end if;
  delete from public.members where id = p_member;
  if p_ban then
    insert into public.server_bans (server_id, profile_id, banned_by, reason)
    values (m.server_id, m.profile_id, auth.uid(), left(p_reason, 512))
    on conflict (server_id, profile_id) do update set reason = excluded.reason;
  end if;
end;
$$;

create or replace function public.unban_member(p_server uuid, p_profile uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator(p_server) then raise exception 'forbidden'; end if;
  delete from public.server_bans where server_id = p_server and profile_id = p_profile;
end;
$$;

-- Gelen isteği reddetme.
create or replace function public.decline_friend_request(p_requester uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships
  where requester_id = p_requester and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Arkadaşlıktan çıkarma ya da gönderilen isteği geri alma.
create or replace function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform private.drop_friendship(auth.uid(), p_other);
end;
$$;

create or replace function public.unblock_user(p_other uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_other;
$$;

create policy storage_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'attachments')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- private şemasındaki fonksiyonlar yalnızca oturum açmış rolce (RLS içinden) çağrılır.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
-- public RPC'ler anonim kullanıcıya kapalı; kayıt ekranındaki kullanıcı adı kontrolü hariç.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.username_available(text) to anon;
