-- The seeded Coordinator role is read-only. Remove any manual/legacy grant that
-- would satisfy the application workflow write gate in 0216.
begin;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.name = 'Coordinator'
  and p.name = 'edit_junction_status';

commit;
