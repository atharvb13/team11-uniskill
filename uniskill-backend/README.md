# UniSkill Backend

FastAPI backend for authentication endpoints backed by Supabase.

## Endpoints

- `GET /health` — `{ "status": "ok" }`
- `POST /api/auth/register`
  - body: `{ "firstName": "Jane", "lastName": "Doe", "username": "janedoe", "email": "jane@umass.edu", "password": "StrongPass1" }`
- `POST /api/auth/login`
  - body: `{ "identifier": "jane@umass.edu", "password": "StrongPass1" }` or `{ "identifier": "janedoe", "password": "StrongPass1" }`
    - If `identifier` contains `@`, it is treated as a `@umass.edu` email; otherwise it is a username (looked up in `public.users` for `contact_email`).
- `GET /api/profile/recommendations`
  - auth required (Bearer token)
  - returns prioritized user matches:
    - `mutual_exchange`: they can teach what you want and you can teach what they want.
    - `one_way_learning`: they can teach what you want, but no reciprocal skill match.
- `GET /api/profile/search?query=<text>&limit=<n>`
  - auth required (Bearer token)
  - searches all users by name/username and skill name
  - returns up to `limit` users with `teach_skills` and `learn_skills`

## Registration and email confirmation

Registration uses **`auth.admin.create_user`** (service role) when **`AUTO_CONFIRM_EMAIL`** is enabled; otherwise it uses **anon `sign_up`**, which triggers Supabase’s **confirmation email** when “Confirm email” is enabled under **Authentication → Providers → Email**. Set **`email_redirect_to`** via **`FRONTEND_ORIGIN`** (default `http://localhost:5173`) → must be allowed under **Authentication → URL configuration → Redirect URLs** (e.g. `http://localhost:5173/email-confirmed`).

- **`AUTO_CONFIRM_EMAIL`**: defaults to **off**. Set **`AUTO_CONFIRM_EMAIL=true`** for dev-only instant confirmation (admin creates and confirms the user; no confirmation email).

**Frontend** needs **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** so the **`/email-confirmed`** page can read the `#access_token` hash and then strip it for a clean URL. Set **Site URL** in Supabase to your real app origin (e.g. **`http://localhost:5173`**, not `3000`) so confirmation links stop pointing at a dead host.

### “Invalid login credentials” with the right password

Usually means **`email_confirmed_at`** is null. Confirm the user in **Authentication → Users**, or set **`AUTO_CONFIRM_EMAIL=true`** in `.env` for dev-only instant login.

### No confirmation email

Check in the Supabase dashboard:

- **Authentication → Providers → Email**: ensure **Confirm email** matches what you want.
- **Authentication → Logs**: look for errors sending email.
- The signup address must be real and able to receive mail.

### `public.users` empty after register

The API **upserts** into `public.users` after auth signup. The **service role** bypasses RLS. If you still see nothing, confirm the table name is exactly `users` in schema `public`, and that `id` is the primary key.

## Password hashing and validation

- Password complexity is validated in the backend before account creation.
- **Supabase Auth** stores credentials in `auth.users` and is used for `/login`.
- The backend also writes **`public.users.password_hash`** using **bcrypt** (one-way hash).

## Database

If `public.users` already exists without `password_hash`, run in Supabase SQL Editor:

```sql
alter table public.users add column if not exists password_hash text;
```

If `expert` proficiency_level fails to save, run:

```sql
-- file: supabase-fix-proficiency-level.sql
```

## Setup

1. Copy `.env.example` to `.env` and set values.
2. Create a virtual environment (recommended) and install dependencies:
   - `python -m venv .venv`
   - `source .venv/bin/activate` (macOS/Linux) or `.venv\Scripts\activate` (Windows)
   - `pip install -r requirements.txt`
3. Start the server from this directory (`uniskill-backend`):
   - `uvicorn app.main:app --reload --port 4000`

The frontend should use **`VITE_API_BASE_URL=http://localhost:4000`** (no trailing `/api`).
