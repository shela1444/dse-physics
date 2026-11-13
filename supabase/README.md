# Concept Check Supabase Setup

Project ref: `rtdhxxzxskkkciqughbr`

## 1. Authenticate and link

```bash
supabase login
supabase link --project-ref rtdhxxzxskkkciqughbr
```

## 2. Apply the database migration

```bash
supabase db push
```

This creates:

- `concept_check_profiles`
- `concept_check_classes`
- `concept_check_memberships`
- `concept_check_attempts`
- `concept_check_student_progress`
- Row Level Security policies and helper functions

## 3. Deploy the account-management function

```bash
supabase functions deploy concept-check-admin
```

The function uses the automatically provided `SUPABASE_SERVICE_ROLE_KEY` environment secret. Never put that key in the static site.

## 4. Configure Authentication

In Supabase Dashboard → Authentication:

- Disable **Allow new users to sign up**.
- Disable anonymous sign-ins.
- Set the Site URL to:

```text
https://shela1444.github.io/dse-physics/concept-check/
```

Password login is used. No email confirmation or magic link is required for teacher-created accounts.

## 5. Create Ms Wu's teacher account

In Authentication → Users → Add user:

```text
Email: wjwu@home.npl.edu.hk
Password: choose privately
```

Confirm the user.

Then run `bootstrap_teacher.sql` in the SQL Editor. It creates the teacher profile for:

```text
Display name: Ms Wu
Internal username: mswu
Role: teacher
```

## 6. First login

Ms Wu signs in through the Teacher tab with:

```text
Email: wjwu@home.npl.edu.hk
Password: the password set in Supabase
```

She can then create a class and upload a student CSV.

## 7. Student login

Students sign in with:

```text
Username
Password
```

They do not enter a class code. Student usernames are globally unique.
Class codes remain visible to the teacher for class organisation, but they
are not used by students to sign in.

## Student CSV format

```csv
display_name,username,default_password
Alice Chan,alice.chan,initial-password
Bob Lee,bob.lee,initial-password
```

- Usernames are lowercase and class-scoped.
- Passwords must be 8-128 characters.
- The CSV is read locally in the teacher dashboard and sent directly to the Edge Function.
- Do not commit a CSV containing student passwords.

A blank template is available at:

```text
concept-check/templates/students-template.csv
```
