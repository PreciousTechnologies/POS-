import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./paths.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4000);

// Serve the built single-page app in production (self-hosted / `npm start`).
// On Vercel this file is unused: the CDN serves `dist/` and api/index.js runs the API.
const distDir = path.join(ROOT_DIR, "dist");
const hasBuild = fs.existsSync(path.join(distDir, "index.html"));

const app = createApp({ staticDir: hasBuild ? distDir : null });

app.listen(PORT, () => {
  console.log(`\n  Kariakoo POS API listening on http://localhost:${PORT}`);
  if (hasBuild) {
    console.log(`  Serving built app from ${distDir}\n`);
  } else {
    console.log("  Dev mode: run the Vite client on http://localhost:5173\n");
  }
});
