-- Çevrimiçi durumu değişince arkadaşlara ve ortak sunuculara anında haber ver.
-- (Önceden istemciler dakikada bir tazeliyordu; biri gelince bir dakika geç görünüyordu.)

create or replace function private.broadcast_presence(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  payload jsonb := jsonb_build_object('user_id', p_user);
  r record;
begin
  for r in
    select case when requester_id = p_user then addressee_id else requester_id end as other
    from public.friendships
    where status = 'accepted' and p_user in (requester_id, addressee_id)
  loop
    perform realtime.send(payload, 'presence_changed', 'user:' || r.other, true);
  end loop;
  for r in select server_id from public.members where profile_id = p_user loop
    perform realtime.send(payload, 'presence_changed', 'server:' || r.server_id, true);
  end loop;
end;
$$;

-- Heartbeat: çevrimdışıyken gelen ilk sinyal "çevrimiçi oldu" olarak yayılır.
create or replace function public.heartbeat()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  prev timestamptz;
begin
  if me is null then return; end if;
  select last_seen_at into prev from public.profiles where id = me;
  update public.profiles set last_seen_at = now() where id = me;
  if prev is null or prev < now() - interval '100 seconds' then
    perform private.broadcast_presence(me);
  end if;
end;
$$;

-- Uygulama kapanırken / çıkış yaparken çağrılır.
create or replace function public.go_offline()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return; end if;
  update public.profiles set last_seen_at = now() - interval '1 day' where id = me;
  perform private.broadcast_presence(me);
end;
$$;

-- Durum, ad, avatar ya da özel durum değişince de yayılır.
create or replace function private.profile_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.status, new.display_name, new.avatar_url, new.custom_status, new.username)
     is distinct from (old.status, old.display_name, old.avatar_url, old.custom_status, old.username) then
    perform private.broadcast_presence(new.id);
  end if;
  return null;
end;
$$;
create trigger profiles_broadcast after update on public.profiles
  for each row execute function private.profile_changed();
