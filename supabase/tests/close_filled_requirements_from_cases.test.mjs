import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
await db.exec(`
  create role anon;
  create role authenticated;
  create table public.requirements (
    id uuid primary key,
    status text not null default 'open',
    positions_required integer not null,
    date_closed date
  );
  create table public.recruitment_cases (
    id uuid primary key,
    requirement_id uuid not null references public.requirements(id),
    prospect_id uuid not null,
    status text not null
  );
  create function public.set_requirement_closed_date() returns trigger
  language plpgsql as $$
  begin
    if old.status = 'open' and new.status = 'closed' then
      new.date_closed := timezone('Asia/Kolkata', now())::date;
    end if;
    return new;
  end $$;
  create trigger requirements_closed_date before update on public.requirements
  for each row execute function public.set_requirement_closed_date();
`)
await db.exec(fs.readFileSync(process.argv[2], 'utf8'))

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const rows = async (sql) => (await db.query(sql)).rows
await db.exec(`insert into public.requirements (id, positions_required) values ('${id(1)}', 2), ('${id(2)}', 1), ('${id(3)}', 1), ('${id(4)}', 1)`)
await db.exec(`insert into public.recruitment_cases (id, requirement_id, prospect_id, status) values
  ('${id(11)}', '${id(1)}', '${id(101)}', 'sent_to_principal'),
  ('${id(12)}', '${id(1)}', '${id(102)}', 'sent_to_principal'),
  ('${id(13)}', '${id(2)}', '${id(103)}', 'sent_to_principal'),
  ('${id(14)}', '${id(3)}', '${id(104)}', 'sent_to_principal')`)

await db.exec(`update public.recruitment_cases set status = 'hired' where id = '${id(11)}'`)
assert.equal((await rows(`select status from public.requirements where id = '${id(1)}'`))[0].status, 'open')
await db.exec(`update public.recruitment_cases set status = 'hired' where id = '${id(12)}'`)
const filled = (await rows(`select status, date_closed from public.requirements where id = '${id(1)}'`))[0]
assert.equal(filled.status, 'closed')
assert.ok(filled.date_closed)

await db.exec(`update public.requirements set status = 'closed' where id = '${id(2)}'`)
await db.exec(`update public.recruitment_cases set status = 'hired' where id = '${id(13)}'`)
assert.equal((await rows(`select status from public.requirements where id = '${id(2)}'`))[0].status, 'closed')
await db.exec(`update public.requirements set status = 'cancelled' where id = '${id(3)}'`)
await db.exec(`update public.recruitment_cases set status = 'hired' where id = '${id(14)}'`)
assert.equal((await rows(`select status from public.requirements where id = '${id(3)}'`))[0].status, 'cancelled')
await db.exec(`insert into public.recruitment_cases (id, requirement_id, prospect_id, status)
  values ('${id(15)}', '${id(4)}', '${id(105)}', 'hired')`)
assert.equal((await rows(`select status from public.requirements where id = '${id(4)}'`))[0].status, 'closed')

assert.equal((await rows(`select has_function_privilege('authenticated', 'public.close_requirement_when_cases_hired()', 'execute') as allowed`))[0].allowed, false)
// Repeated case cycles for one person must not fill two positions.
await db.exec(`insert into public.requirements (id, positions_required) values ('${id(5)}', 2)`)
await db.exec(`insert into public.recruitment_cases (id, requirement_id, prospect_id, status) values
  ('${id(16)}', '${id(5)}', '${id(106)}', 'hired'),
  ('${id(17)}', '${id(5)}', '${id(106)}', 'hired')`)
assert.equal((await rows(`select status from public.requirements where id = '${id(5)}'`))[0].status, 'open')
await db.exec(`insert into public.recruitment_cases (id, requirement_id, prospect_id, status)
  values ('${id(18)}', '${id(5)}', '${id(107)}', 'hired')`)
assert.equal((await rows(`select status from public.requirements where id = '${id(5)}'`))[0].status, 'closed')
// An aborted hire must roll back both the case and its automatic requirement close.
await db.exec(`insert into public.requirements (id, positions_required) values ('${id(6)}', 1)`)
await db.exec(`begin; insert into public.recruitment_cases (id, requirement_id, prospect_id, status)
  values ('${id(19)}', '${id(6)}', '${id(108)}', 'hired')`)
assert.equal((await rows(`select status from public.requirements where id = '${id(6)}'`))[0].status, 'closed')
await db.exec('rollback')
assert.equal((await rows(`select status from public.requirements where id = '${id(6)}'`))[0].status, 'open')
assert.equal((await rows(`select count(*)::int as n from public.recruitment_cases where id = '${id(19)}'`))[0].n, 0)
console.log('PASS: closes on the last hire or hired insert, preserves manual closure/cancellation, deduplicates hires, rolls back atomically, denies direct client execution')
