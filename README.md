# Personal School Management System

A full school/university management system built with TanStack Start, React, Vite, Supabase, Tailwind CSS, role-based access, Khmer/English language support, and dark mode.

## System Modules

- Admin, teacher, and student authentication
- Role-based dashboards and navigation
- Student profiles, enrollment, academic details, and issued login IDs
- Teacher profiles, staff IDs, class assignment, and teacher workspace
- Classes, subjects, shifts, rooms, and timetables
- Student and teacher attendance
- Exams, subject scores, reports, certificates, notifications, and payments
- Supabase database migrations with RLS-focused access rules

## Personal Branding

Copy `.env.example` to `.env.local`, then update the personal branding values:

```sh
cp .env.example .env.local
```

Key branding variables:

```sh
VITE_INSTITUTION_NAME_EN="Your School Name"
VITE_INSTITUTION_NAME_KM="ឈ្មោះសាលារបស់អ្នក"
VITE_INSTITUTION_SHORT_NAME="YSS"
VITE_INSTITUTION_FULL_NAME="ឈ្មោះសាលារបស់អ្នក (Your School Name)"
VITE_INSTITUTION_LOGO_URL="https://example.com/logo.png"
VITE_SYSTEM_NAME="Personal School Management System"
VITE_HERO_IMAGE_URLS="https://example.com/campus-1.jpg,https://example.com/campus-2.jpg"
VITE_ACCOUNT_EMAIL_DOMAIN="studentsphere.local"
```

If a branding value is omitted, the app falls back to the current RULE defaults.

## Local Development

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Real admin accounts sign in with email/password. Student and teacher accounts sign in with the ID and password created by an admin.

## Login Testing

Use the public login page for student and teacher accounts:

- Student: select `Student`, enter the issued student ID, then enter the password created by an admin.
- Teacher: select `Teacher`, enter the issued teacher ID, then enter the password created by an admin.
- Admin: open `/admin-login`, then sign in with the admin email and password.

Student and teacher IDs are converted to internal email aliases with `VITE_ACCOUNT_EMAIL_DOMAIN`, so users only need their issued school ID on the login form. If Supabase Auth reports `Database error querying schema` for the seeded admin user, run `npm run repair:admin` with the local service role key configured.

## Supabase Setup

1. Create a Supabase project.
2. Put the project URL and publishable key in `.env.local`.
3. Apply the database schema from `supabase/generated/full_database_setup.sql`, then apply any newer files in `supabase/migrations/`.
4. Run the admin seed/login SQL in `supabase/migrations/20260428040500_fix_admin_seed_login.sql` or create an admin account through your chosen Supabase auth flow.
5. Start the app and sign in as admin.

Required environment variables:

```sh
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-for-local-repair-only"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
VITE_SUPABASE_PROJECT_ID="your-project-id"
```

If the seeded admin account returns `Database error querying schema`, add the service role key locally and run:

```sh
npm run repair:admin
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser/client deployment variables.

## Production Build

```sh
npm run build
```

## Deploy to Vercel

This app is configured for TanStack Start on Vercel with Nitro.

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Add all Supabase and `VITE_*` branding environment variables.
4. Deploy with the default project settings. Vercel runs `npm install` and `npm run build`.
