-- URL güvenliği ve değişmez sütun korumaları.

-- Resim/dosya URL'leri yalnızca bu projenin public storage'ını gösterebilir
-- (dış URL'ler görüntüleyenin IP'sini sızdırır).
create or replace function public.is_storage_url(u text)
returns boolean language sql immutable set search_path = '' as $$
  select u is null
      or u like 'https://nandcazkmsfnceneguux.supabase.co/storage/v1/object/public/%';
$$;

alter table public.profiles add constraint profiles_avatar_url_check
  check (public.is_storage_url(avatar_url));
alter table public.servers add constraint servers_icon_url_check
  check (public.is_storage_url(icon_url));
alter table public.messages add constraint messages_file_url_check
  check (public.is_storage_url(file_url));
alter table public.direct_messages add constraint direct_messages_file_url_check
  check (public.is_storage_url(file_url));

-- Admin sunucuda yalnızca ad ve simgeyi değiştirir; davet kodu RPC ile yenilenir.
create or replace function public.servers_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  if current_user in ('anon', 'authenticated') then
    new.invite_code := old.invite_code;
  end if;
  return new;
end;
$$;
create trigger servers_guard before update on public.servers
  for each row execute function public.servers_guard();

-- Moderatör kanalda ad, konu ve sırayı değiştirir; sunucu ve tür sabittir.
create or replace function public.channels_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.last_message_at := null;
    new.created_at := now();
  else
    new.id := old.id;
    new.server_id := old.server_id;
    new.type := old.type;
    new.created_at := old.created_at;
    if current_user in ('anon', 'authenticated') then
      new.last_message_at := old.last_message_at;
    end if;
  end if;
  return new;
end;
$$;
create trigger channels_guard before insert or update on public.channels
  for each row execute function public.channels_guard();
