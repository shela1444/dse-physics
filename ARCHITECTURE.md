# HKDSE Physics Concept Check — Architecture

## Purpose

A Class B revision site for HKDSE Physics. The homepage links to topic summaries and ten-question true/false quizzes. Authentication is required before a quiz can start, and completed quiz attempts are saved to Supabase for the signed-in student.

## Live paths

| Page | URL |
|---|---|
| Root redirect | `https://shela1444.github.io/dse-physics/` |
| Concept Check homepage | `https://shela1444.github.io/dse-physics/concept-check/` |
| Login | `https://shela1444.github.io/dse-physics/concept-check/login.html` |
| Teacher dashboard | `https://shela1444.github.io/dse-physics/concept-check/teacher.html` |
| Kinematics quiz | `https://shela1444.github.io/dse-physics/concept-check/RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=kinematics` |
| Force and Motion quiz | `https://shela1444.github.io/dse-physics/concept-check/RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=force` |

## Deployment layout

```text
dse-physics/
├── .nojekyll
├── .gitignore
├── ARCHITECTURE.md
├── index.html                          # redirects to concept-check/
├── concept-check/
│   ├── index.html                      # "Take 5 minutes break!" homepage
│   ├── login.html
│   ├── teacher.html
│   ├── auth.css
│   ├── auth-client.js
│   ├── progress.js
│   ├── teacher.js
│   ├── login.js
│   ├── supabase-config.js
│   ├── vendor/
│   │   └── supabase-js.min.js
│   ├── templates/
│   │   └── students-template.csv
│   ├── RS_HKDSE_M_Mechanics_TF_Quiz.html
│   ├── RS_HKDSE_M_Kinematics.html
│   └── RS_HKDSE_M_Force and Motion.html
└── supabase/
    ├── config.toml
    ├── bootstrap_teacher.sql
    ├── migrations/
    │   └── 20261112000000_concept_check.sql
    └── functions/
        └── concept-check-admin/
            └── index.ts
```

## Authentication model

Supabase Auth is used with teacher-issued accounts. Public sign-ups and anonymous sign-ins are disabled.

### Student login

Class code + username + password, mapped to a hidden synthetic email:

```text
<class-code>.<username>@students.conceptcheck.example
```

### Teacher login

Teacher email `wjwu@home.npl.edu.hk` + password. The internal class-membership username remains `mswu`.

Student synthetic addresses are never used for email delivery. Student accounts are created through the teacher dashboard and the secure Edge Function. Ms Wu's teacher account is created once in Supabase Auth and bootstrapped with the teacher role.

## Quiz access

- Homepage and summaries are public.
- A quiz requires an authenticated student.
- Signed-out users are redirected to `login.html` with a `next` parameter preserving the quiz topic.
- Teachers are redirected to `teacher.html`.
- Guest attempts, anonymous auth, and local guest progress do not exist.

## Data model

- `concept_check_profiles`
- `concept_check_classes`
- `concept_check_memberships`
- `concept_check_attempts`
- `concept_check_student_progress` view

Every completed quiz by a signed-in student creates one attempt row containing:

- attempt UUID
- class ID
- student ID
- topic
- score
- total
- per-question answers as JSONB
- completion timestamp

The progress panel and teacher dashboard read only account-synced attempts.

## Row Level Security

- Students read their own profile, memberships, attempts, and progress.
- Students insert only attempts for themselves in a class where they are a student.
- Teachers read student profiles, memberships, and attempts only for classes where they have a teacher membership.
- Anonymous users have no access.
- Classes, memberships, and accounts are written through the service-role Edge Function, never directly by the browser.
- The service-role key is stored only in Supabase Edge Function secrets.

## Account-management Edge Function

`concept-check-admin` validates the caller's teacher JWT and supports:

- `create_class`
- `bulk_create_students`
- `reset_password`

It never logs or returns passwords. Passwords are hashed by Supabase Auth.

## Teacher dashboard

- Teacher-only page.
- Create classes and generate class codes.
- Import students from a local CSV.
- Reset student passwords.
- View account-synced class progress.

CSV format:

```csv
display_name,username,default_password
```

The CSV is read locally, sent over HTTPS to the Edge Function, and never committed to the repository.

## Static configuration

`concept-check/supabase-config.js` contains:

- Supabase project URL
- publishable key
- synthetic email domains

The publishable key is public by design. RLS is the security boundary.

## Setup

See `supabase/README.md` for:

- applying the migration
- deploying the Edge Function
- configuring Supabase Auth
- creating Ms Wu's teacher account
- running the teacher bootstrap SQL

## Validation

- Signed-out quiz access redirects to login.
- Login preserves the requested quiz topic.
- Authenticated students can complete and save attempts.
- Every completed attempt appears in the student's progress panel.
- Teachers can log in, manage classes/accounts, and view class progress.
- Student attempts are invisible to other students.
- Teacher data is scoped to their classes.
- No anonymous or guest progress exists.
