# UniSkill Backend

Express backend for authentication endpoints backed by Supabase.

## Endpoints

- `POST /api/auth/register`
  - body: `{ "firstName": "Jane", "lastName": "Doe", "username": "janedoe", "email": "jane@umass.edu", "password": "StrongPass1" }`
- `POST /api/auth/login`
  - body: `{ "identifier": "jane@umass.edu", "password": "StrongPass1" }` or `{ "identifier": "janedoe", "password": "StrongPass1" }`
    - If `identifier` contains `@`, it is treated as a `@umass.edu` email; otherwise it is a username (looked up in `public.users` for `contact_email`).

## Registration and email confirmation

Registration uses **`auth.admin.createUser`** (service role) so the row exists in `auth.users` before inserting into `public.users`, which avoids **`users_id_fkey`** foreign-key errors.

- **`AUTO_CONFIRM_EMAIL`**: defaults to **off**. Registration uses **anon `auth.signUp`**, which triggers Supabase’s **confirmation email** when “Confirm email” is enabled under **Authentication → Providers → Email**. Set **`emailRedirectTo`** via **`FRONTEND_ORIGIN`** (default `http://localhost:5173`) → must be allowed under **Authentication → URL configuration → Redirect URLs** (e.g. `http://localhost:5173/email-confirmed`).
- **`AUTO_CONFIRM_EMAIL=true`**: uses **`auth.admin.createUser`** instead — **no confirmation email** is sent; users are confirmed immediately for fast local login.

**Frontend** needs **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** so the **`/email-confirmed`** page can read the `#access_token` hash and then strip it for a clean URL. Set **Site URL** in Supabase to your real app origin (e.g. **`http://localhost:5173`**, not `3000`) so confirmation links stop pointing at a dead host.

### “Invalid login credentials” with the right password

Usually means **`email_confirmed_at`** is null. Confirm the user in **Authentication → Users**, or set **`AUTO_CONFIRM_EMAIL=true`** in `.env` for dev-only instant login.

For confirmation links that redirect to your app, set **Authentication → URL configuration**: **Site URL** and **Redirect URLs** (e.g. `http://localhost:5173/email-confirmed`).

### No confirmation email

Check in the Supabase dashboard:

- **Authentication → Providers → Email**: ensure **Confirm email** matches what you want. If confirmations are off, Supabase may not send a signup confirmation (behavior depends on project settings).
- **Authentication → Logs**: look for errors sending email.
- **Project Settings → Auth**: if you use custom SMTP, verify it; otherwise Supabase’s built-in mail can land in **spam** or be delayed.
- The signup address must be real and able to receive mail.

### `public.users` empty after register

The API **upserts** into `public.users` after `auth.signUp`, so a row should appear if RLS/policies allow the **service role** (they bypass RLS). If you still see nothing, open **Table Editor** with the `service_role` / SQL editor and confirm the table name is exactly `users` in schema `public`, and that `id` is the primary key.

## Password hashing and validation

- Password complexity is validated in the backend before account creation.
- **Supabase Auth** hashes the real credential in `auth.users` and is used for `/login`.
- After signup, the backend also writes **`public.users.password_hash`** using **bcrypt** (one-way hash; never store plaintext passwords).

## Database

If `public.users` already exists without `password_hash`, run in Supabase SQL Editor:

```sql
alter table public.users add column if not exists password_hash text;
```

## Setup

1. Copy `.env.example` to `.env` and set values.
2. Install dependencies:
   - `npm install`
3. Start server:
   - `npm run dev`

Server runs on `http://localhost:4000` by default.
