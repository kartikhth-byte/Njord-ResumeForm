// Run with @electric-sql/pglite installed in the module lookup path:
// node remove_coordinator_application_write_grant.test.mjs <migration.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const db = new PGlite()
const migration = fs.readFileSync(process.argv[2], 'utf8')
await db.exec(`
  create table roles (id integer primary key, name text unique);
  create table permissions (id integer primary key, name text unique);
  create table role_permissions (role_id integer, permission_id integer);
  insert into roles values (1, 'Master Recruiter'), (2, 'Recruiter'), (3, 'Coordinator');
  insert into permissions values (1, 'edit_junction_status'), (2, 'view_requirements');
  insert into role_permissions values (1, 1), (2, 1), (3, 1), (3, 2);
`)
await db.exec(migration)
await db.exec(migration)
const { rows } = await db.query(`
  select r.name, p.name as permission
  from role_permissions rp
  join roles r on r.id = rp.role_id
  join permissions p on p.id = rp.permission_id
  order by r.id, p.id
`)
const expected = [
  ['Master Recruiter', 'edit_junction_status'],
  ['Recruiter', 'edit_junction_status'],
  ['Coordinator', 'view_requirements'],
]
if (JSON.stringify(rows.map(({ name, permission }) => [name, permission])) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected RBAC grants: ${JSON.stringify(rows)}`)
}
console.log('PASS Coordinator write grant removed; editor and view grants preserved; rerun safe')
await db.close()
