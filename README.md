# IQ Funnel — Admin Panel

React + Vite + TypeScript admin UI for `new-funnel-backend`, styled with
Tailwind CSS v4 and shadcn/ui components. **Wired to the live backend** — login,
dashboard, and quiz modules all read real data from `/admin/*`.

## Run

```bash
npm install
cp .env.example .env      # points at http://localhost:5001
npm run dev               # http://localhost:5174
```

The backend must be running (`cd ../new-funnel-backend && npm run dev`).

> Vite reads `.env` at **startup**. If you change `VITE_API_BASE_URL`, restart
> the dev server — HMR will not pick it up.

### Signing in

Accounts are provisioned on the server; there is no self-registration or
password reset in the UI. Create one from the backend:

```bash
cd ../new-funnel-backend
npm run create:admin -- --name "Jane Doe" --email jane@example.com --password "s3cret!!"
```

Sign in with that **email** and password.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5174 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Typecheck only |

## Screens

- **Login** — email + password against `POST /admin/auth/login`. No registration,
  no password reset, by design.
- **Dashboard** — four KPI cards from `GET /admin/dashboard/stats` with a
  date-range filter, plus a recent-submissions table.
- **Quiz** — paginated list from `GET /admin/quiz-submissions`: search by quiz ID
  or customer email, purchase-status filter, language filter, date range.
- **Quiz detail** — `GET /admin/quiz-submissions/:id`: quiz result and category
  scores, attribution, customer account, transactions, subscriptions.
- **Email Marketing** — the abandoned-checkout sequence, from
  `/admin/email-marketing/*`. Turn the sequence on or off, add and remove steps,
  edit each step's delay, discount code and email template, and set the batch
  size, retry limit and the "ignore quizzes older than" guard. Also shows
  per-step send counts, recent activity with failure reasons, a **Run now**
  button, and a **Send a test** box that delivers a design to your own inbox
  without writing a tracking row — so a test never consumes anyone's place in
  the sequence.

  Everything on this page is stored in the `email_marketing_settings` and
  `email_marketing_steps` tables and saved as one transaction, so a save that
  fails partway cannot leave the ladder with the wrong offer on some rungs.
  Removing a step keeps its send history; a step's key is fixed once created,
  because renaming it would orphan that history and send the rung again.

  **Send a test** covers the transactional emails too — the welcome with its
  brain-training credentials, and the report-ready notice — not just the
  marketing ladder. Those two are triggered by the funnel itself (a settled
  first sale, and the customer saving their details) and so have nothing to
  configure here, but previewing them is the same one-click job. The step
  picker stays marketing-only, since a step runs the discount ladder.

  The page loads its dropdowns from the same response as the settings, so it can
  only ever offer a template or discount code the backend will accept. A banner
  at the top says plainly whether mail would actually be delivered right now:
  three separate things have to be true (credentials present, transport on,
  sequence on), and it names whichever ones are not.

## Structure

```
src/
  components/ui/       shadcn/ui primitives
  components/layout/   AppLayout, Sidebar, Header
  components/common/   DateRangePicker, StatCard, StatusBadge, EmptyState, ErrorState
  context/             auth provider — restores the session via /admin/auth/me
  lib/http.ts          fetch wrapper: bearer token, envelope, 401 handling
  lib/api.ts           one function per admin endpoint
  lib/format.ts        currency / date / duration formatting
  pages/               Login, Dashboard, QuizList, QuizDetail, EmailMarketing
  types/               mirrors the /admin response shapes
```

## How auth works

`POST /admin/auth/login` returns a **60-day** bearer token. It is kept in
`localStorage` (`iq-admin-token`) so the session survives a browser restart, and
attached as `Authorization: Bearer …` to every subsequent call.

On boot, the app does not trust the stored token: if one exists it calls
`GET /admin/auth/me` and only treats the operator as signed in if that succeeds.
Routes hold on a spinner until that check settles, so a reload never flashes the
login screen at a signed-in user.

Any request that comes back **401** — the token expired, or the account was
deactivated server-side — clears the token and drops the session, which sends
the router to `/login`. A failed sign-in is exempt: it shows an inline error
rather than tearing down a session that never existed.

Admin routes are exempt from the funnel's `x-api-key`, so no API key is needed
in this app — which is the point: a browser bundle cannot keep a shared secret.

## Notes

- **Date filters** send the operator's local day as full ISO timestamps, so
  "Today" means today where the operator is rather than in UTC. The backend
  accepts either that or a bare `YYYY-MM-DD`.
- **Money** renders JPY zero-decimal and GBP two-decimal, keyed off each row's
  language, matching `FUNNEL_PRICING` on the backend.
- **Failed requests** render an inline retry instead of an empty table, so a
  backend that is down looks different from a filter that matched nothing.
