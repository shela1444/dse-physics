-- Students now sign in with a globally unique username instead of
-- class code + username. Class codes remain internal to the teacher
-- dashboard and are not used in the student login form.

create unique index if not exists concept_check_memberships_student_username_global_idx
    on public.concept_check_memberships (lower(username))
    where role = 'student';
