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
