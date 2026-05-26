import { Router } from "express";

const router = Router();

const METRO_URL =
  "https://c484433b-3f55-4b1e-b015-ded79524100d-00-2hqobu0ft2u3w.expo.picard.replit.dev";
const DEEP_LINK = `exp+hydrapulse://expo-development-client/?url=${encodeURIComponent(METRO_URL)}`;

router.get("/connect", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open HydraPulse</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0f1e;
      color: #e2e8f0;
      font-family: -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      gap: 24px;
    }
    h1 { font-size: 22px; font-weight: 600; }
    p { font-size: 15px; color: #94a3b8; text-align: center; max-width: 320px; }
    a.btn {
      display: block;
      background: #3b82f6;
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      padding: 18px 40px;
      border-radius: 14px;
      text-decoration: none;
      text-align: center;
    }
    code {
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      text-align: center;
      max-width: 340px;
    }
  </style>
</head>
<body>
  <h1>HydraPulse Dev Client</h1>
  <p>Tap the button below on your iPhone to connect the app to the Metro bundler.</p>
  <a class="btn" href="${DEEP_LINK}">Open HydraPulse</a>
  <code>${DEEP_LINK}</code>
</body>
</html>`);
});

export default router;
