# Izoh

Izoh is a Telegram Mini App for places that want to collect guest feedback through QR forms. A guest scans a QR code, opens a short Telegram form, chooses what they want to send, and the team receives the submission in Telegram.

The product has four runtime parts:

- Web Mini App: React, Vite, Telegram Mini App SDK.
- API: Hono HTTP server for Telegram auth, admin APIs, guest forms, media, PDF generation, and Telegram webhooks.
- Notification Dispatcher: worker that sends queued submissions to Telegram chats.
- Organization Deletion Worker: worker that deletes organizations and their media from the database and object storage.

## Stack

- React 19, TanStack Router, TanStack Query
- Hono, grammy, Telegram Mini App SDK
- PostgreSQL, Prisma 7 with the `pg` adapter
- Cloudflare R2 for production media storage
- sharp for image processing
- pdfkit and qrcode for QR PDF generation
- Vitest and TypeScript for verification

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev:all
```

`npm run dev:all` starts the API, Mini App, Notification Dispatcher, and Organization Deletion Worker together. The script picks available ports and prints the local URLs.

For local media, Izoh uses `.tmp/izoh-media` when R2 variables are missing and `NODE_ENV` is not `production`.

## Environment

Required for API and workers:

```bash
DATABASE_URL="postgresql://..."
TELEGRAM_BOT_TOKEN=""
TELEGRAM_BOT_USERNAME="izohappbot"
TELEGRAM_WEBHOOK_SECRET=""
```

Required in production for media:

```bash
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="izoh-media"
R2_PUBLIC_BASE_URL="https://media.example.com"
MENU_MODULE_ROLLOUT_ENABLED="false"
```

Required for the web service when API is deployed on another domain:

```bash
VITE_API_BASE_URL="https://api.example.com"
```

Required for Telegram Mini Apps Analytics and Trending Apps eligibility:

```bash
VITE_TG_ANALYTICS_TOKEN=""
```

`R2_PUBLIC_BASE_URL` must be a public HTTPS URL because Telegram needs reachable media URLs for submission attachments.
`VITE_TG_ANALYTICS_TOKEN` is issued in TON Builders for the Mini App domain and bot URL.

`MENU_MODULE_ROLLOUT_ENABLED` is fail-closed in production. Keep it `false` while deploying the
menu migration and the new revision to every API and worker service. After all older Prisma clients
have been drained, set it to `true` on the API service to expose Menu to every organization. This
two-phase rollout prevents older instances from reading enum values they do not know.

## Scripts

```bash
npm run dev:all                         # full local stack
npm run dev:web                         # Vite only
npm run dev:api                         # API only
npm run dev:notification-dispatcher     # Telegram delivery worker
npm run dev:organization-deletion-worker # deletion worker
npm run dev:qr-pdf-dispatcher           # QR PDF delivery worker

npm run verify                          # typecheck + tests
npm run typecheck
npm run test

npm run build:web
npm run build:api
npm run build:notification-dispatcher
npm run build:organization-deletion-worker
npm run build:qr-pdf-dispatcher

npm run start:web
npm run start:api
npm run start:notification-dispatcher
npm run start:organization-deletion-worker
npm run start:qr-pdf-dispatcher

npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio

npm run admin:grant -- <telegram_id>
npm run admin:grant-subscription -- --org <organization_id_or_slug>
```

## Deployment

The recommended Railway layout is:

- PostgreSQL plugin.
- Web service.
- API service.
- Notification Dispatcher service.
- Organization Deletion Worker service.
- QR PDF Dispatcher service.

API service:

```bash
Build: npm run build:api
Pre-deploy: npm run predeploy:api
Start: npm run start:api
```

Web service:

```bash
Build: npm run build:web
Start: npm run start:web
```

Notification Dispatcher:

```bash
Build: npm run build:notification-dispatcher
Start: npm run start:notification-dispatcher
```

Organization Deletion Worker:

```bash
Build: npm run build:organization-deletion-worker
Start: npm run start:organization-deletion-worker
```

QR PDF Dispatcher:

```bash
Build: npm run build:qr-pdf-dispatcher
Start: npm run start:qr-pdf-dispatcher
```

After the API is deployed, set the Telegram webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://api.example.com/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Set the bot Mini App menu button in BotFather so users can open the app from the Telegram menu.

## Product Flow

1. Admin creates an organization in the Mini App.
2. Izoh creates default modules, owner notifications, and a trial subscription.
3. Admin configures guest form sections, staff, notification targets, and QR layouts.
4. QR PDFs encode the organization slug and optional context code.
5. Guest opens the QR form in Telegram, submits feedback, complaint, or suggestion.
6. API stores the submission and queues Telegram deliveries.
7. Notification Dispatcher sends messages and attachments to the configured Telegram targets.

## Runtime Notes

- Telegram init data protects admin APIs and authenticated user actions.
- Telegram webhook requests should use `TELEGRAM_WEBHOOK_SECRET`.
- Public guest submission and media upload endpoints have a small in-memory rate limit for launch-day protection.
- When the API is scaled to multiple instances, move rate limiting to the edge or a shared store.

## Media

Images are uploaded through short-lived upload sessions:

1. API creates a `MediaUploadSession`.
2. Browser uploads the original image directly to local storage or R2.
3. API finalizes the session, validates metadata, processes the image with `sharp`, writes final assets, and removes the temporary object.

Production media uses R2. Local development uses `.tmp/izoh-media`.

## Assets

- `src/server/assets/telegram/start-cover.jpg` is the `/start` bot cover image.
- `public/emoji/fluent-3d` contains the local 3D emoji PNG assets used in QR PDF scenes and previews.
- `src/assets/fonts/open-runde` contains PDF/UI font assets.

The Fluent emoji assets are from Microsoft Fluent Emoji and are used under their published license.

## Data Model

`prisma/schema.prisma` is the source of truth. The main ownership chain is:

- `User` owns `Organization`.
- `Organization` owns module settings, guest contexts, staff, submissions, notification targets, subscriptions, and deletion jobs.
- `Submission` owns submission attachments and notification deliveries.
- `MediaUploadSession` and `MediaAsset` track object storage files independently by `owner_type` and `owner_id`.

Organization deletion is asynchronous. The API marks the organization as `DELETING` and creates an `OrganizationDeletionJob`; the deletion worker removes database records and storage objects.

## Generated Files

These paths are generated or local-only and should not be committed:

- `dist`
- `coverage`
- `prisma/generated`
- `.tmp`
- `.env`
- `.DS_Store`
