-- Concept Check: authentication, classes, memberships, and quiz progress
-- Project: rtdhxxzxskkkciqughbr

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.concept_check_profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null,
    username text not null,
    role text not null default 'student' check (role in ('student', 'teacher')),
    created_at timestamptz not null default now()
);

create table if not exists public.concept_check_classes (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null unique,
    created_by uuid not null references auth.users (id) on delete restrict,
    created_at timestamptz not null default now()
);

create table if not exists public.concept_check_memberships (
    class_id uuid not null references public.concept_check_classes (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    username text not null,
    role text not null check (role in ('student', 'teacher')),
    joined_at timestamptz not null default now(),
    primary key (class_id, user_id)
);

create unique index if not exists concept_check_memberships_class_username_idx
    on public.concept_check_memberships (class_id, lower(username));

create table if not exists public.concept_check_attempts (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.concept_check_classes (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    topic text not null,
    score integer not null check (score >= 0),
    total integer not null check (total > 0),
    answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
    completed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint concept_check_attempts_score_within_total check (score <= total)
);

create index if not exists concept_check_attempts_user_topic_completed_idx
    on public.concept_check_attempts (user_id, topic, completed_at desc);

create index if not exists concept_check_attempts_class_completed_idx
    on public.concept_check_attempts (class_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

create or replace function public.concept_check_is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.concept_check_memberships m
        where m.class_id = p_class_id
          and m.user_id = auth.uid()
    );
$$;

create or replace function public.concept_check_is_class_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.concept_check_memberships m
        where m.class_id = p_class_id
          and m.user_id = auth.uid()
          and m.role = 'teacher'
    );
$$;

create or replace function public.concept_check_is_class_student(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.concept_check_memberships m
        where m.class_id = p_class_id
          and m.user_id = auth.uid()
          and m.role = 'student'
    );
$$;

create or replace function public.concept_check_teacher_can_view_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.concept_check_memberships teacher
        join public.concept_check_memberships student
          on student.class_id = teacher.class_id
        where teacher.user_id = auth.uid()
          and teacher.role = 'teacher'
          and student.user_id = p_user_id
          and student.role = 'student'
    );
$$;

revoke all on function public.concept_check_is_class_member(uuid) from public, anon;
revoke all on function public.concept_check_is_class_teacher(uuid) from public, anon;
revoke all on function public.concept_check_is_class_student(uuid) from public, anon;
revoke all on function public.concept_check_teacher_can_view_user(uuid) from public, anon;
grant execute on function public.concept_check_is_class_member(uuid) to authenticated;
grant execute on function public.concept_check_is_class_teacher(uuid) to authenticated;
grant execute on function public.concept_check_is_class_student(uuid) to authenticated;
grant execute on function public.concept_check_teacher_can_view_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.concept_check_profiles enable row level security;
alter table public.concept_check_classes enable row level security;
alter table public.concept_check_memberships enable row level security;
alter table public.concept_check_attempts enable row level security;

drop policy if exists concept_check_profiles_select_self on public.concept_check_profiles;
create policy concept_check_profiles_select_self
    on public.concept_check_profiles
    for select
    to authenticated
    using (id = auth.uid());

drop policy if exists concept_check_profiles_select_teacher on public.concept_check_profiles;
create policy concept_check_profiles_select_teacher
    on public.concept_check_profiles
    for select
    to authenticated
    using (public.concept_check_teacher_can_view_user(id));

drop policy if exists concept_check_classes_select_member on public.concept_check_classes;
create policy concept_check_classes_select_member
    on public.concept_check_classes
    for select
    to authenticated
    using (public.concept_check_is_class_member(id));

drop policy if exists concept_check_memberships_select_own_or_teacher on public.concept_check_memberships;
create policy concept_check_memberships_select_own_or_teacher
    on public.concept_check_memberships
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or public.concept_check_is_class_teacher(class_id)
    );

drop policy if exists concept_check_attempts_select_own_or_teacher on public.concept_check_attempts;
create policy concept_check_attempts_select_own_or_teacher
    on public.concept_check_attempts
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or public.concept_check_is_class_teacher(class_id)
    );

drop policy if exists concept_check_attempts_insert_own_student on public.concept_check_attempts;
create policy concept_check_attempts_insert_own_student
    on public.concept_check_attempts
    for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and public.concept_check_is_class_student(class_id)
    );

-- ---------------------------------------------------------------------------
-- Progress view
-- ---------------------------------------------------------------------------

drop view if exists public.concept_check_student_progress;
create view public.concept_check_student_progress
with (security_invoker = true) as
select
    m.class_id,
    c.name as class_name,
    c.code as class_code,
    m.user_id,
    p.display_name,
    m.username,
    count(a.id)::integer as total_attempts,
    count(a.id) filter (where a.topic = 'kinematics')::integer as kinematics_attempts,
    max(a.score) filter (where a.topic = 'kinematics') as kinematics_best,
    (array_agg(a.score order by a.completed_at desc) filter (where a.topic = 'kinematics'))[1] as kinematics_latest,
    max(a.completed_at) filter (where a.topic = 'kinematics') as kinematics_last_at,
    count(a.id) filter (where a.topic = 'force')::integer as force_attempts,
    max(a.score) filter (where a.topic = 'force') as force_best,
    (array_agg(a.score order by a.completed_at desc) filter (where a.topic = 'force'))[1] as force_latest,
    max(a.completed_at) filter (where a.topic = 'force') as force_last_at,
    max(a.completed_at) as last_attempt_at
from public.concept_check_memberships m
join public.concept_check_classes c
    on c.id = m.class_id
join public.concept_check_profiles p
    on p.id = m.user_id
left join public.concept_check_attempts a
    on a.class_id = m.class_id
   and a.user_id = m.user_id
where m.role = 'student'
group by
    m.class_id,
    c.name,
    c.code,
    m.user_id,
    p.display_name,
    m.username;

-- ---------------------------------------------------------------------------
-- API privileges
-- ---------------------------------------------------------------------------

revoke all on public.concept_check_profiles from anon;
revoke all on public.concept_check_classes from anon;
revoke all on public.concept_check_memberships from anon;
revoke all on public.concept_check_attempts from anon;
revoke all on public.concept_check_student_progress from anon;

grant select on public.concept_check_profiles to authenticated;
grant select on public.concept_check_classes to authenticated;
grant select on public.concept_check_memberships to authenticated;
grant select on public.concept_check_attempts to authenticated;
grant insert on public.concept_check_attempts to authenticated;
grant select on public.concept_check_student_progress to authenticated;
