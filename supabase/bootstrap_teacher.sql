-- Run this after creating Ms Wu's Supabase Auth user:
--   email: mswu@staff.conceptcheck.example
--   password: set privately in the Supabase Dashboard
--
-- The account must already exist in Authentication > Users.

insert into public.concept_check_profiles (id, display_name, username, role)
select
    id,
    'Ms Wu',
    'mswu',
    'teacher'
from auth.users
where lower(email) = 'mswu@staff.conceptcheck.example'
on conflict (id) do update
set
    display_name = excluded.display_name,
    username = excluded.username,
    role = excluded.role;

-- Verify the bootstrap.
select id, display_name, username, role
from public.concept_check_profiles
where username = 'mswu' and role = 'teacher';
