# UniSkill - Skill-sharing and interest-matching platform

Students within any university possess a wide range of valuable skills, from programming and design to music and sports, but there is currently no centralized platform that allows them to easily share these skills or connect with peers who want to learn them. As a result, opportunities for peer-to-peer learning and collaboration are often missed or limited to small social circles. UniSkill addresses this problem by providing a structured platform where students can discover others with complementary skills and interests. Users register with their university email and create profiles that highlight the skills they can teach and the skills they wish to learn, along with proficiency levels. The system includes a searchable skill directory with keyword matching, autocomplete, and personalized recommendations to help users quickly find relevant peers.

The primary users of UniSkill are students from the Five College community (it would primarily be implemented for students of UMass Amherst initially) who act as both learners and mentors within the platform. Other stakeholders include the broader university community that benefits from knowledge exchange, potential faculty or administrators who may support or oversee the platform, and the developers responsible for building and maintaining the system. The main objective of UniSkill is to create a trusted, campus-specific ecosystem that facilitates skill discovery, peer learning, and collaborative growth. By enabling students to send learning requests, track active collaborations through a dashboard, and communicate through an integrated chat system once a request is accepted, the platform encourages meaningful engagement and practical skill development. This system is needed to bridge the gap between students who want to learn new skills and those willing to share their expertise, thereby strengthening collaboration and knowledge sharing across the Five College community.

---

## Project Overview

UniSkill allows students to sign up with their UMass email, build a skill profile, and discover peers who can teach what they want to learn. The platform is built with a React frontend, a FastAPI backend, and a PostgreSQL database managed through Supabase.

Evaluation report: see `EVALUATION.md`.

---

## Tech Stack

- **Frontend:** React, Tailwind CSS, Framer Motion, Vite
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL via Supabase
- **Authentication:** Supabase Auth (JWT based)

---

## Features Implemented

### Authentication
- User registration restricted to `@umass.edu` email addresses
- Login via UMass email or username
- JWT based session management
- Email confirmation flow with configurable auto confirm for development
- bcrypt password hashing stored alongside Supabase Auth credentials
- Client side and server side validation for all auth inputs

### User Profile
- Fetch and update profile information including first name, last name, and bio
- Public profile endpoint accessible by username
- Profile data persisted in the `public.users` table linked to Supabase Auth

### Skill Management
- Add skills a user wants to learn, with a target proficiency level
- Add skills a user can teach, with a current proficiency level
- Edit proficiency levels for both learning and teaching skills
- Remove skills from a profile
- Skills are created in a shared catalogue on first use and reused across users
- Skill names are normalized to title case to avoid duplicates

### Onboarding
- Three step onboarding modal shown to new users on first login
- Step 1: skills to learn with goal proficiency level
- Step 2: skills to teach with current proficiency level
- Step 3: optional bio
- Validates for duplicate entries and prevents the same skill appearing in both learn and teach lists

### Dashboard
- Displays profile card with name, username, and email
- Editable name and bio fields with save functionality
- Two skill panels showing learning goals and teachable skills
- Add, edit, and delete modals for managing skills post onboarding
- Rerun setup option to reset and redo the onboarding flow

---

## Project Structure

```
uniskill/
├── uniskill-backend/
│   ├── app/
│   │   ├── main.py               # App entry point, router registration, CORS
│   │   ├── supabase_clients.py   # Supabase admin and auth client setup
│   │   ├── routes/
│   │   │   ├── auth.py           # Register and login endpoints
│   │   │   ├── profile.py        # Profile fetch and update endpoints
│   │   │   └── skills.py         # Skill catalogue and user skill endpoints
│   │   └── utils/
│   │       ├── validation.py     # Email, username, and password validation
│   │       └── auth_env.py       # Auto confirm email environment flag
│   ├── supabase-schema.sql       # Database schema
│   └── requirements.txt
│
└── uniskill-frontend/
    ├── src/
    │   ├── App.jsx                        # Route definitions
    │   ├── pages/
    │   │   ├── LoginPage.jsx              # Login UI
    │   │   ├── RegisterPage.jsx           # Registration UI
    │   │   ├── DashboardPage.jsx          # Main dashboard
    │   │   └── EmailConfirmedPage.jsx     # Post email confirmation landing
    │   ├── components/
    │   │   ├── AuthLayout.jsx             # Shared shell for auth pages
    │   │   ├── FormField.jsx              # Reusable input with icon and error
    │   │   ├── PasswordStrength.jsx       # Live password strength indicator
    │   │   ├── ProtectedRoute.jsx         # Auth guard for protected pages
    │   │   ├── ProfileOnboardingModal.jsx # First login setup wizard
    │   │   └── dashboard/
    │   │       ├── DashboardBody.jsx      # Profile and skill management UI
    │   │       └── skillConstants.js      # Proficiency level options
    │   └── utils/
    │       ├── api.js             # All backend HTTP calls
    │       ├── session.js         # Token storage and session helpers
    │       ├── validation.js      # Client side form validation
    │       └── onboardingLocal.js # Local onboarding state helpers
    └── package.json
```

---

## Database Schema

### `public.users`
Stores user profile information linked to Supabase Auth.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key, references auth.users |
| username | text | Unique |
| first_name | text | |
| last_name | text | |
| bio | text | |
| contact_email | text | UMass email |
| profile_picture_url | text | |
| linkedin_url | text | |
| github_url | text | |
| portfolio_url | text | |
| program | text | |
| degree_type | text | |
| date_of_joining | date | |
| password_hash | text | bcrypt hash |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `public.skills`
Global catalogue of all skills across the platform.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Title cased, normalized |
| category | text | Optional |
| created_at | timestamptz | |

### `public.user_skills`
Junction table linking users to skills with flags and proficiency.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | References public.users |
| skill_id | uuid | References public.skills |
| proficiency_level | text | beginner, intermediate, advanced, expert |
| can_teach | boolean | |
| wants_to_learn | boolean | |
| created_at | timestamptz | |

Unique constraint on `(user_id, skill_id)`.

---

## API Endpoints

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{ "status": "ok" }` |

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login with email or username |

**Register body:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "username": "janedoe",
  "email": "jane@umass.edu",
  "password": "StrongPass1"
}
```

**Login body:**
```json
{ "identifier": "jane@umass.edu", "password": "StrongPass1" }
```
or
```json
{ "identifier": "janedoe", "password": "StrongPass1" }
```

### Profile
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/profile/me` | Required | Get logged in user profile |
| PATCH | `/api/profile/me` | Required | Update name, bio, or profile picture |
| GET | `/api/profile/{username}` | None | Get public profile by username |

### Skills
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/skills` | None | List all skills in catalogue |
| GET | `/api/skills/me` | Required | Get logged in user's skills |
| POST | `/api/skills/me` | Required | Add a skill to user profile |
| PATCH | `/api/skills/me/{skill_id}` | Required | Update a user skill |
| DELETE | `/api/skills/me/{skill_id}` | Required | Remove a skill from profile |

---

## Setup and Running Locally

### Backend

1. Navigate to the backend directory:
```
cd uniskill-backend
```

2. Create and activate a virtual environment:
```
python -m venv .venv
source .venv/bin/activate        # macOS and Linux
.venv\Scripts\activate           # Windows
```

3. Install dependencies:
```
pip install -r requirements.txt
```

4. Copy the example env file and fill in your Supabase credentials:
```
cp .env.example .env
```

5. Run the database schema in your Supabase SQL Editor:
```
supabase-schema.sql
```

6. Start the server:
```
uvicorn app.main:app --reload --port 4000
```

### Frontend

1. Navigate to the frontend directory:
```
cd uniskill-frontend
```

2. Install dependencies:
```
npm install
```

3. Copy the example env file and fill in your values:
```
cp .env.example .env
```

4. Start the development server:
```
npm run dev
```

---

## Environment Variables

### Backend (`uniskill-backend/.env`)

| Variable | Description |
|---|---|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anon public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key |
| FRONTEND_ORIGIN | Frontend URL for email redirect (default: http://localhost:5173) |
| AUTO_CONFIRM_EMAIL | Set to `true` to skip email confirmation in development |

### Frontend (`uniskill-frontend/.env`)

| Variable | Description |
|---|---|
| VITE_API_BASE_URL | Backend URL (default: http://localhost:4000) |
| VITE_SUPABASE_URL | Your Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Supabase anon public key |

---

## Common Issues

**"Invalid login credentials" with the correct password**
This usually means the user's email has not been confirmed. Go to Supabase dashboard, Authentication, Users, and confirm the user manually. Alternatively set `AUTO_CONFIRM_EMAIL=true` in the backend `.env` for local development.

**Dashboard shows "API unreachable"**
Make sure the FastAPI server is running on port 4000 and that `VITE_API_BASE_URL` in the frontend `.env` points to the correct address. Restart `npm run dev` after changing env values.

**`public.users` is empty after registration**
The API upserts into `public.users` after Supabase Auth signup using the service role key. Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly and that the table name is exactly `users` in the `public` schema.

---

## Planned Features (Post Midpoint)

- Skill based search and user discovery with autocomplete
- Recommendation engine matching learners to teachers
- Learning request system with daily limits and request expiry
- 1:1 chat between matched users using Supabase Realtime
- Profile completion gating for request and chat access
- Additional profile fields including location, social handles, program, and degree type
- Compulsory learning motivation description per skill

---