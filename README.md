# POS-

Kariakoo POS is a retail point-of-sale demo for Tanzanian mini-markets. It covers the counter, stock, sales, reports, staff, and business settings in one workspace.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Express 5
- SQLite

## Getting started

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4000
- Vite proxies `/api` requests to the API server.

The SQLite database is created automatically at `data/pos.db` on first run. Runtime data, logs, and the session secret are not committed.

## Deploy to Vercel

This repo deploys as one Vercel project: Vite builds the SPA to `dist/` and `api/index.js` exposes the Express API as a single serverless function. `vercel.json` pins the framework preset, build command, output directory, and routing.

1. Import the repository at [vercel.com/new](https://vercel.com/new), or deploy from the CLI: `npx vercel` (preview) then `npx vercel --prod`.
2. Keep the detected **Vite** framework preset — no build settings need to be changed.
3. Add one environment variable under **Project → Settings → Environment Variables**:

   | Name | Value |
   | --- | --- |
   | `SESSION_SECRET` | Random string, e.g. `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` |

   Without it the server generates a secret per function instance, so sessions break whenever an instance is recycled.

No API URL has to be configured: the client calls same-origin `/api`, which `vercel.json` routes to the function.

### Serverless caveats

Vercel Functions may only write under `/tmp`, so `POS_DATA_DIR` defaults to a temp folder there and the SQLite database is **ephemeral**:

- The demo data is seeded on the first request of each function instance (about a second) and thrown away when that instance is recycled.
- Seed IDs are deterministic, so the demo accounts and catalog are identical on every instance. Only new writes (sales, stock changes, new products) stay on the instance that handled them, and separate instances do not share a database.

That is fine for a demo. For durable data, either back the app with a hosted database (Postgres or Turso instead of SQLite) or host the API on a machine with a persistent disk and proxy to it from Vercel:

```json
{ "rewrites": [{ "source": "/api/:path*", "destination": "https://your-api.example.com/:path*" }] }
```

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Cashier | `cashier` | `cashier123` |

## Scripts

```bash
npm run dev        # Run the API and web app together
npm run dev:server # Run only the API
npm run dev:web    # Run only Vite
npm run build      # Type-check and build for production
npm start          # Serve the built app and API
npm run preview    # Preview the production build
npm run typecheck  # TypeScript check only
```

## Notes

- Mobile money and card payments are simulated.
- The app defaults to the `Africa/Dar_es_Salaam` business timezone.
- Use the theme switcher in the header to change the glass theme.
