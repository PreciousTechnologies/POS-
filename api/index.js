// Vercel Functions entry point.
//
// Vercel serves the built Vite app from `dist/` on the CDN and routes every
// `/api/*` request here (see vercel.json). The Express app is exported directly
// so the platform can invoke it as a single serverless function — no listener.
import { createApp } from "../server/app.js";

const app = createApp();

export default app;
