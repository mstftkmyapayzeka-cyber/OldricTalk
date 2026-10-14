-- Her mesajda channels.last_message_at güncellenir; bu güncelleme yapısal değişiklik
-- sayılıp tüm üyelere 'structure_changed' yayını yapmasın (istemciler zaten
-- message_created olayıyla son mesaj zamanını işler).
create or replace function private.broadcast_structure()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  sid uuid;
  payload jsonb;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_table_name = 'channels' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'last_message_at') = (to_jsonb(old) - 'last_message_at') then
    return null;
  end if;
  if tg_table_name = 'servers' then
    sid := r.id;
  else
    sid := r.server_id;
  end if;
  payload := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', r.id, 'server_id', sid);
  perform realtime.send(payload, 'structure_changed', 'server:' || sid, true);
  if tg_table_name = 'members' then
    perform realtime.send(payload, 'membership_changed', 'user:' || r.profile_id, true);
  end if;
  return null;
end;
$$;
