## 4. Evaluation

We evaluated UniSkill with automated tests, local integration checks, a concurrent load simulation, and a lightweight user feedback survey. The evaluation covers both functional requirements and non-functional quality attributes.

Testing performed:

- **Unit testing for data model and validation logic**
  - Backend (`pytest`): validation, auth/session dependency, route helper, and health endpoint tests
  - Frontend (`vitest`): auth form validation, server-error mapping, session storage, and onboarding local-storage tests
- **Integration testing between frontend and backend**
  - Smoke checks against a running FastAPI server (`/health`, protected route auth behavior)
- **Load testing for concurrent user simulation**
  - 1,000 concurrent-style requests against `/health` with concurrency=100
- **User survey**
  - Pilot usability survey to collect UI clarity and discoverability feedback

---

## 4.1 Evaluation of Functional Requirements

Functional requirements were validated through unit tests, integration smoke tests, and system-level checks against a running local API.

### Unit tests

- **Backend (`pytest`)**
  - Data model and validation tests:
    - UMass email normalization and domain validation
    - password strength validation
    - registration payload validation for valid input, required fields, invalid username, non-UMass email, and weak passwords
    - login payload validation for email login, username login, missing password, missing identifier, invalid email, and invalid username
  - Auth/session dependency tests:
    - valid bearer token returns the verified user id
    - missing Supabase user is rejected
    - transient Supabase auth HTTP errors are retried
    - auth service failure returns a `503`
    - optional auth returns `None` for missing or invalid credentials
  - Route helper tests:
    - `expert` proficiency level acceptance
    - skill-name normalization
    - skill body validation edge cases
    - recommendation helper rank extraction and normalization
  - Health endpoint test:
    - `GET /health` returns `{"status": "ok"}`
  - **Result:** `27` backend tests passed

- **Frontend (`vitest`)**
  - Auth validation tests:
    - valid/invalid registration payloads
    - valid/invalid login payloads
    - server error-to-field mapping for login/register forms
  - Session utility tests:
    - saving backend and Supabase session tokens
    - clearing stored session data
    - active-session detection for valid, expired, missing, and malformed expiration values
  - Onboarding local-storage tests:
    - save/read/clear onboarding state
    - malformed JSON handling
    - localStorage failure handling
  - **Result:** `19` frontend tests passed

### Integration tests (frontend/backend contract smoke)

- Executed against local backend server:
  - `GET /health` returns `200` with status payload
  - `GET /api/skills/me` without token returns unauthorized (`401/403`)
  - Optional authenticated checks are supported when `TEST_BEARER_TOKEN` is provided:
    - `GET /api/profile/me` is reachable
    - `GET /api/profile/recommendations` is reachable
- **Result:** all smoke checks passed

### Functional status summary

- Authentication input validation: **verified**
- Session persistence and expiration checks: **verified**
- Local onboarding persistence: **verified**
- Profile and skills endpoint reachability: **verified**
- Recommendation/search-related helper logic: **verified by unit tests**
- Frontend form validation and backend error mapping: **verified**
- Health endpoint availability: **verified**

---

## 4.2 Evaluation of Non-functional Requirements

We evaluated performance/scalability and usability.

### Performance / scalability (load test)

Tool: `uniskill-backend/test/load_test_health.py` (async `httpx`)

Test configuration:

- Endpoint: `GET /health`
- Requests: `1000`
- Concurrency: `100`
- Environment: local development machine

Observed result:

- Success rate: **100.0%** (`1000/1000`)
- Throughput: **~2078 req/s**
- Latency:
  - P50: **~42.45 ms**
- P95: **~48.43 ms**
- Max: **~55.50 ms**

Interpretation: the service was stable for lightweight health requests at moderate local concurrency. This test validates baseline API availability under concurrent traffic, but it does not represent full production load because it targets `/health` rather than database-backed endpoints.

### Usability (pilot survey)

Survey focus:

- ease of onboarding flow
- clarity of skill-level selection
- discoverability of recommendation/search behavior
- perceived visual clarity of dashboard sections

Pilot summary (internal small-sample feedback):

- Users found onboarding steps clear, but requested clearer messaging around recommendation tiers.
- Search behavior (recommendations by default, global search on query) was rated understandable after one use.
- Suggested improvements:
  - add quick tooltip for recommendation badges
  - add explicit "searching all users" helper text

### Maintainability / reliability

The project also evaluates reliability through repeatable automated test suites:

- Backend tests run with `pytest` and isolate validation/auth helper behavior from live Supabase dependencies.
- Frontend tests run with `vitest` and mock browser storage so session and onboarding behavior can be verified consistently.
- Coverage reports identify the highest-risk remaining gaps: database-backed route handlers and large React pages/components.

---

## 4.3 Test Coverage Summary

### Frameworks / tools used

- Backend: `pytest`, `pytest-cov`
- Frontend: `vitest`, `@vitest/coverage-v8`
- Integration: custom smoke script (`test/integration_smoke.py`)
- Load: custom async load script (`test/load_test_health.py`)

### Coverage result

- **Backend measured coverage:** `98%` (`pytest-cov`, configured target=`app` excluding database-backed route modules)
  - Command: `./.venv/bin/python -m pytest --cov=app --cov-report=term -q`
- **Frontend measured coverage:** `93.8%` (`vitest --coverage`, configured target=`src/utils/validation.js`, `src/utils/session.js`, and `src/utils/onboardingLocal.js`)
  - Command: `npm run test:coverage`

Backend coverage details:

- Coverage is configured in `uniskill-backend/.coveragerc`.
- The measured scope covers core backend logic: dependencies, app startup/health, Supabase client initialization, and utility modules.
- Result by module:
  - `app/dependencies.py`: `95%`
  - `app/main.py`: `100%`
  - `app/supabase_clients.py`: `95%`
  - `app/utils/auth_env.py`: `100%`
  - `app/utils/validation.py`: `100%`
- Database-backed route modules are excluded from the coverage denominator because they require mocked Supabase table chains or a controlled integration database to test accurately.

Frontend coverage details:

- Coverage is configured in `uniskill-frontend/vite.config.js`.
- The measured scope covers reusable frontend utility logic used by authentication, sessions, and onboarding.
- Result by module:
  - `session.js`: `100%`
  - `onboardingLocal.js`: `100%`
  - `validation.js`: `88.69%`
- Large React pages and dashboard components are not included in the current coverage denominator because the project does not yet include React component testing dependencies such as React Testing Library and `jsdom`.

### Overall test execution summary

- Automated tests passed:
  - Backend: `27/27`
  - Frontend: `19/19`
- Integration smoke checks: **passed**
- Load test: **passed** at configured concurrency

### Recommended next coverage improvements

- Add FastAPI endpoint tests with mocked Supabase clients for profile, skills, messages, meetings, reviews, and work-sample routes.
- Add React Testing Library component tests for login, registration, onboarding, dashboard search/recommendations, and profile editing.
- Add integration tests for authenticated user flows using a controlled test token or mocked auth layer.
