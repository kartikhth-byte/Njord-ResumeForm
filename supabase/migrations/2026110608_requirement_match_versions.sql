-- Requirement edits must invalidate the version sent to Needle. Existing
-- closure RPCs already request old+1; the trigger still increments only once.
begin;
create or replace function public.version_requirement_edit()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.version:=old.version+1;
  return new;
end $$;
drop trigger if exists version_requirement_edit on public.requirements;
create trigger version_requirement_edit before update on public.requirements
for each row execute function public.version_requirement_edit();

create or replace function public.version_requirement_nationality_edit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op<>'INSERT' then
    update public.requirements set version=version+1,updated_at=now() where id=old.requirement_id;
  end if;
  if tg_op<>'DELETE' and (tg_op='INSERT' or new.requirement_id is distinct from old.requirement_id) then
    update public.requirements set version=version+1,updated_at=now() where id=new.requirement_id;
  end if;
  return null;
end $$;
drop trigger if exists version_requirement_nationality_edit on public.requirement_nationalities;
create trigger version_requirement_nationality_edit after insert or update or delete
on public.requirement_nationalities for each row
execute function public.version_requirement_nationality_edit();
commit;
