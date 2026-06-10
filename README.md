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
npm run deploy:prepare
npm run deploy
npm run dev:all
npm run dev
npm run dev:api
npm run db:generate
npm run db:migrate
npm run typecheck
npm test
npm run build
```

The Mini App dev server uses `http://localhost:5173/` by default and moves to the
next free port when needed.

`npm run setup` prepares `.env`, generates Prisma Client, and syncs the local
database schema without resetting data. Use `npm run setup:verify` when you also
want typecheck and tests. Use `npm run dev:all` to start both the Mini App and
API.

`npm run deploy:prepare` performs one-time deployment preparation: Prisma
generation and migrations (or `prisma db push` fallback when migration files are
absent). Use `npm run deploy:prepare:verify` when you also want preflight
checks (`typecheck` + `test`).

`npm run deploy` runs preparation and then starts the API in production mode using
`npm run start`. This is the recommended script to wire into Railway/CI deploy
commands.

## Environment

Copy `.env.example` to `.env` and fill:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
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
- `src/server/domain` - product domain flows
- `prisma/schema.prisma` - database model in the `cheerly.to` schema style

## Media Flow

1. API creates a `MediaUploadSession` and short-lived presigned R2 `PUT` URL.
2. Browser uploads the original image directly to a temp R2 object.
3. API finalizes the session, validates R2 object metadata, downloads temp object, compresses with `sharp`, writes final delivery assets, and deletes the temp object.
4. The database stores `MediaAsset` records for final assets only. Originals are not retained.
