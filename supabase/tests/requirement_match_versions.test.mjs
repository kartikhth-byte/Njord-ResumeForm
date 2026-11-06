import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const db = new PGlite()
await db.exec(`create table requirements(id int primary key,version int not null default 1,updated_at timestamptz default now(),title text);
create table requirement_nationalities(requirement_id int references requirements(id),nationality_id int);
insert into requirements(id,title) values(1,'Synthetic'),(2,'Other synthetic');`)
await db.exec(fs.readFileSync(process.argv[2], 'utf8'))
const version=async id=>(await db.query('select version from requirements where id=$1',[id])).rows[0].version
await db.exec("update requirements set title='Synthetic v2' where id=1")
assert.equal(await version(1),2)
await db.exec('update requirements set version=version+1 where id=1')
assert.equal(await version(1),3) // existing RPC increments are not doubled
await db.exec('update requirements set version=1 where id=1')
assert.equal(await version(1),4) // caller cannot reuse an old version
await db.exec('insert into requirement_nationalities values(1,10)')
assert.equal(await version(1),5)
await db.exec('update requirement_nationalities set nationality_id=11 where requirement_id=1')
assert.equal(await version(1),6)
await db.exec('update requirement_nationalities set requirement_id=2 where requirement_id=1')
assert.equal(await version(1),7);assert.equal(await version(2),2)
await db.exec('delete from requirement_nationalities where requirement_id=2')
assert.equal(await version(2),3)
await db.close()
console.log('Requirement versions: PASS (row edits, existing RPC single increment, caller tampering, nationality edits/moves/deletes)')
