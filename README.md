# Izoh

Telegram Mini App for organization feedback, suggestions, complaints, staff-targeted ratings, QR entry points, and Telegram bot notifications.

## Stack

- Vite + React + TypeScript
- TanStack Router
- Tailwind CSS 4 with CSS-first tokens
- Hono Node API
- Prisma 7 + PostgreSQL
- Cloudflare R2 for media
- `grammy` for Telegram bot delivery
- `@telegram-apps/sdk` and `@telegram-apps/sdk-react` for TMA integration

## Commands

```bash
npm install
npm run setup
npm run dev:all
npm run dev:web
npm run dev:api
npm run dev:notification-dispatcher
npm run dev:organization-deletion-worker
npm run build:web
npm run build:api
npm run build:notification-dispatcher
npm run build:organization-deletion-worker
npm run predeploy:api
npm run verify
npm run admin:grant-subscription -- --org <organization_id_or_slug>
npm run db:generate
npm run db:migrate
npm run typecheck
npm test
```

The Mini App dev server uses `http://localhost:5173/` by default and moves to the
next free port when needed.

`npm run setup` prepares `.env`, generates Prisma Client, and syncs the local
database schema without resetting data. Use `npm run setup:verify` when you also
want typecheck and tests. Use `npm run dev:all` to start the Mini App, API,
Notification Dispatcher, and Organization Deletion Worker together.

`npm run build:web` is safe without `DATABASE_URL`. API and worker builds run
Prisma generation because they use the generated client.

`npm run predeploy:api` runs `prisma migrate deploy`. Production deploys do not
fall back to `prisma db push`; a migration failure should stop the deploy.

## Subscriptions

Every new organization starts with a 7 day trial. When access expires, the guest
form stays unavailable until the owner pays with Telegram Stars or a system admin
grants access manually.

- Monthly plan: `500 Stars`, recurring through Telegram.
- Annual plan: `5000 Stars`, prepaid access for one year.
- Annual payments are not recurring because Telegram Bot API Stars subscriptions
  currently renew only every 30 days.

Manual grant for internal support:

```bash
npm run admin:grant-subscription -- --org coffee-place --plan annual --reason "Partner"
```

## Railway

Izoh is designed for five Railway services:

- `Postgres` - Railway PostgreSQL plugin.
- `Web` - Vite preview for the Telegram Mini App.
- `API` - Hono API and Telegram webhook.
- `Notification Dispatcher` - long-running queue processor with no public HTTP.
- `Organization Deletion Worker` - long-running organization hard-delete processor with no public HTTP.

Recommended service commands:

| Service                      | Build command                                      | Start command                                |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Web                          | `npm run build:web`                                | `npm run start:web`                          |
| API                          | `npm run build:api && npm run predeploy:api`       | `npm run start:api`                          |
| Notification Dispatcher      | `npm run build:notification-dispatcher`            | `npm run start:notification-dispatcher`      |
| Organization Deletion Worker | `npm run build:organization-deletion-worker`       | `npm run start:organization-deletion-worker` |

API exposes `GET /api/health` for health checks. Workers should not expose a
health endpoint; they poll pending jobs from Postgres, claim them with DB locks,
and retry with backoff.

Telegram group notifications are connected only through the native Telegram group picker:

1. Owner opens organization notification settings.
2. Owner taps the group selection row.
3. Telegram opens the group picker and adds the bot with a short internal payload.
4. API webhook receives `/start@bot PAYLOAD`, activates the group target, and sends a short success message to the group.

Configure the Telegram webhook after the API domain is available:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR_API_DOMAIN/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Environment

Copy `.env.example` to `.env` and fill:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_USERNAME`
- `VITE_API_BASE_URL` for the Web service when API is on a separate Railway domain
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

`R2_PUBLIC_BASE_URL` should be a production custom domain/CDN URL because Telegram needs HTTPS URLs for media attachments.

## Key Paths

- `src/common/ui` - UI components copied and adapted from `cheerly.to`
- `src/assets/styles/tokens.css` - OpenRunde, Tailwind v4 theme tokens, semantic variables, TMA layout variables
- `src/shared/i18n/locales/{ru,uz}/*.json` - shared FE/BE translations split by module
- `src/shared/tma` - TMA SDK wrapper and React provider
- `src/server/media` - R2 upload sessions, direct browser PUT, processing, final public assets
- `src/server/telegram` - init data validation and bot notifications
- `src/server/notification-dispatcher` - Telegram delivery outbox polling, locks, retry/backoff
- `src/server/organization-deletion-worker` - queued organization deletion, storage cleanup, retry/backoff
- `src/server/domain` - product domain flows
- `prisma/schema.prisma` - database model in the `cheerly.to` schema style

## Notification Flow

1. Guest submits a review, complaint, or suggestion.
2. API saves the submission and attachments.
3. API selects active organization notification targets and creates pending
   `TelegramNotificationDelivery` rows.
4. API immediately responds to the guest.
5. Notification Dispatcher claims pending rows, sends Telegram messages or media
   groups, then marks deliveries `SENT`, `FAILED`, or schedules retry.
6. Permanent Telegram failures for a group mark that group target `DISCONNECTED`.

## Media Flow

1. API creates a `MediaUploadSession` and short-lived presigned R2 `PUT` URL.
2. Browser uploads the original image directly to a temp R2 object.
3. API finalizes the session, validates R2 object metadata, downloads temp object, compresses with `sharp`, writes final delivery assets, and deletes the temp object.
4. The database stores `MediaAsset` records for final assets only. Originals are not retained.
