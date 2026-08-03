# Fullstack Code Challenge — Onboarding Team

React and TypeScript frontend for the insurance quote challenge. The application guides an applicant through Personal Information, age-dependent Coverage questions, a server-accepted read-only Review, and quote submission. The backend owns quote IDs, statuses, premiums, state transitions, retries, and expiration.

The browser integration verified by this repository uses:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8080`

These are distinct origins. The backend CORS allowlist was verified for `http://localhost:5173`; `http://127.0.0.1:5173` is a different browser origin and is not interchangeable.

## Features

- Validated Personal Information with name, email, age, and ZIP code retained as a string.
- `POST /quotes` creation with unchanged-quote reuse and safe replacement behavior.
- Basic, Standard, and Premium Coverage selection.
- Explicit supplemental medical answers only when the server-accepted age is greater than 65.
- `PATCH /quotes/{id}/coverage` with server-authoritative premium.
- Read-only Review built from the active server quote.
- No-body `POST /quotes/{id}/submit` with semantic `SUBMITTED` validation.
- Retryable insurer failure and timeout states, bounded reconciliation, explicit same-quote retry, submission-in-progress handling, expiration handling, and Start New Quote.
- Immediate duplicate-request guards, responsive layouts, keyboard operation, focus transitions, status text, and accessible error/loading foundations.

## Technology stack

The lockfile-backed Phase 8 verification used Node 24.13.0 and npm 11.6.2.

- React 19.2.8 and React DOM 19.2.8
- TypeScript 6.0.3 in strict mode
- Vite 8.2.0
- Material UI 9.2.0 with Emotion 11.14
- React Hook Form 7.84.0, Yup 1.7.1, and Hook Form resolvers 5.7.1
- Vitest 4.1.10, React Testing Library 16.3.2, and user-event 14.6.1
- Node MSW 2.15.0 for isolated tests
- Playwright 1.62.1 with Chromium for real browser/backend tests
- Multi-stage Docker build and unprivileged Nginx static runtime

## Architecture

- React Hook Form owns transient form values and Yup-backed validation.
- `QuoteFlowProvider` and `quoteFlowReducer` own the wizard step, active server quote, submitted personal snapshot, active request, and actionable submission/error state.
- The complete `QuoteResponse` returned by the backend is authoritative for ID, status, accepted Coverage, age-dependent answers, and premium.
- A typed fetch client owns headers and endpoint calls. Runtime parsers reject malformed success responses before they enter state.
- Vitest uses Node MSW with unhandled requests treated as errors. Production runtime imports no MSW code and starts no browser worker.
- Playwright observes, but never fulfills or modifies, requests to the real backend.

## Backend contract

The frontend expects an already-running backend at `http://localhost:8080` with these endpoints:

```text
POST  /quotes
GET   /quotes/{id}
PATCH /quotes/{id}/coverage
POST  /quotes/{id}/submit
GET   /actuator/health
```

Requests use `X-API-Key`. JSON bodies are sent only for create and Coverage update; submit deliberately sends no body and does not fabricate `Content-Type`. Premiums and workflow statuses come only from backend responses.

The challenge also requires a public link to the sibling backend repository. No backend repository URL is configured in this checkout, so that link must be supplied before publishing the final submission.

## Prerequisites

- Node.js 24 and npm 11 (the Docker build pins Node 24.13.0)
- the challenge backend running on port 8080
- Docker 29 or compatible for the container workflow
- Playwright Chromium for real E2E verification

Check the backend before starting the frontend:

```bash
curl http://localhost:8080/actuator/health
```

## Environment setup

Create the ignored local file from the safe template:

```bash
cp .env.example .env.local
```

Set both nonblank values:

```text
VITE_API_BASE_URL=http://localhost:8080
VITE_API_KEY=replace-with-your-local-api-key
```

Do not commit `.env.local`. Vite resolves `VITE_*` variables at build time and exposes them to browser JavaScript. The API key is challenge configuration, not a server-side secret; it is visible to an end user in the built application and browser requests. A production system should not use a browser-embedded key as its only security boundary.

## Run locally with the backend

Start the backend from its own repository first, using that repository's documented startup command. Then run:

```bash
npm ci
npm run dev -- --host localhost
```

Open `http://localhost:5173`. Do not substitute the IP-literal origin when testing the verified CORS integration.

## Production build

```bash
npm run build
```

The static production output is written to `dist/`. Changing either Vite environment value requires rebuilding the application or Docker image.

## Tests

```bash
npm run typecheck
npm run lint
npm run test:run
npm run test:coverage
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:report
```

Vitest/component/integration tests are isolated with Node MSW. Playwright starts the real Vite frontend and calls the real backend; the backend and valid `.env.local` must already be available.

Install the tested Chromium browser once if needed:

```bash
npx playwright install chromium
```

Playwright runs serially with zero retries locally because tests create unique backend records and external insurer behavior should not be hidden as retry noise. HTML reports, traces, screenshots, and test results are generated only as ignored artifacts.

## Docker

The image uses digest-pinned Node Alpine and unprivileged Nginx stages. Configuration is intentionally build-time because that matches Vite's existing environment boundary. No API proxy, Vite development server, Node source, MSW, or Playwright runtime is present in the final stage.

Pass the ignored environment as a BuildKit secret mount. It is available only to the build step and is not copied into an image layer or expanded in normal build output:

```bash
docker build \
  --secret id=vite_env,src=.env.local \
  -t fullstack-challenge-frontend:local .
```

The key is not copied from `.env.local` or hard-coded in Docker source, but it is embedded in the built browser assets by Vite as described above.

Run the image on the verified frontend origin:

```bash
docker run --rm --name fullstack-challenge-frontend \
  -p 5173:8080 \
  fullstack-challenge-frontend:local
```

Open `http://localhost:5173`. The static server listens on container port 8080 and does not proxy backend requests.

To run the existing real E2E suite against an already-running container instead of starting Vite:

```bash
PLAYWRIGHT_EXTERNAL_SERVER=true \
PLAYWRIGHT_BASE_URL=http://localhost:5173 \
npm run test:e2e
```

Stop the foreground container with `Ctrl+C`; a detached container can be stopped with `docker stop fullstack-challenge-frontend`.

## CORS

Browser requests intentionally cross from `http://localhost:5173` to `http://localhost:8080`. Do not disable browser security, add a frontend proxy, or use `http://127.0.0.1:5173`. Successful create, Coverage, and submit calls in the Chromium suite are the real CORS evidence.

## Security and privacy

- `.env.local`, coverage output, Playwright artifacts, build output, and dependencies are ignored.
- Form and medical values are not written to localStorage, sessionStorage, or browser MSW.
- Runtime code does not log request bodies, credentials, or raw insurer responses.
- Start New Quote clears frontend references; it does not claim to delete the backend quote.
- Automated browser tests use synthetic names and `.invalid` email addresses.

## Test data and backend retention

Real E2E tests create unique synthetic records and retain the exact created ID for each flow. The backend exposes no delete endpoint, so those records remain subject to its own retention or expiration policy. Avoid unnecessary repeated real E2E runs against shared environments.

## Approach, decisions, and AI use

The project was delivered in documented phases: contract and architecture recovery, typed API/runtime boundaries, reducer-driven forms, server Coverage and premium, submission lifecycle, usability/accessibility refinement, real-browser integration, and final packaging. Server authority and narrow application commands were favored over duplicated client state or speculative business logic. Rare insurer and invalid-state failures remain deterministic in MSW tests, while successful CORS and contract paths are verified in Chromium against the real backend.

AI coding-agent assistance was used for requirements analysis, implementation, test design/execution, and documentation. The resulting work was checked with strict TypeScript, ESLint, Vitest/MSW, coverage, production builds, Playwright, the real backend, and Docker verification. Detailed decisions and command evidence are in `docs/phase1.md` through `docs/phase8.md`.

## Known limitations

- The public sibling-backend repository URL is not available in this checkout and must be added before publication.
- Real-browser evidence is Chromium-only; it is not multi-browser certification.
- Accessibility work is a tested foundation, not a formal WCAG audit or screen-reader certification.
- The application bundle remains above Vite's 500 kB advisory threshold for the required React/MUI stack.
- The challenge API key is browser-visible by design.
- Rare insurer failure paths are tested deterministically with Node MSW rather than forced against the real insurer. A live insurer timeout can also make a real happy-path run fail without indicating a frontend defect.
- The backend must already be running; this repository does not own or package it.

## Troubleshooting

### Browser reports a CORS failure

Use `http://localhost:5173`, not `http://127.0.0.1:5173`, and confirm the API base URL is `http://localhost:8080`.

### Backend is unavailable

Open `http://localhost:8080/actuator/health` and confirm the service reports `UP`.

### Playwright cannot find Chromium

Run `npx playwright install chromium`.

### Environment validation fails

Confirm `.env.local` exists and both required values are nonblank. Rebuild after changing values used by a production build or Docker image.

### Port 5173 is already in use

Stop the existing Vite process or delivery container before starting another frontend. Playwright can reuse an intentional existing development server, but Docker and Vite should not compete for the same host port.

### npm reports `min-release-age`

The current npm environment emits an advisory that this config key will stop working in a future npm major. It does not fail installation, validation, tests, or builds.
