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
  <title>HydraPulse – Connect</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0f1e;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      gap: 20px;
    }
    h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
    .step { font-size: 14px; color: #94a3b8; text-align: center; max-width: 320px; line-height: 1.6; }
    .step strong { color: #e2e8f0; }
    #qr {
      background: #fff;
      padding: 16px;
      border-radius: 16px;
      display: inline-block;
    }
    .divider {
      width: 280px;
      height: 1px;
      background: #1e293b;
      margin: 4px 0;
    }
    .sub { font-size: 12px; color: #475569; text-align: center; }
    a.btn {
      display: block;
      background: #1d4ed8;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 36px;
      border-radius: 12px;
      text-decoration: none;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>HydraPulse Dev Client</h1>

  <p class="step">
    <strong>Step 1:</strong> Open this page on your <strong>computer</strong> browser.<br>
    <strong>Step 2:</strong> Scan the QR code below with your <strong>iPhone Camera app</strong>.<br>
    <strong>Step 3:</strong> Tap the banner iOS shows to open HydraPulse.
  </p>

  <div id="qr"></div>

  <div class="divider"></div>
  <p class="sub">— or tap below if you're already on your iPhone —</p>
  <a class="btn" href="${DEEP_LINK}">Open HydraPulse</a>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    new QRCode(document.getElementById("qr"), {
      text: ${JSON.stringify(DEEP_LINK)},
      width: 260,
      height: 260,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  </script>
</body>
</html>`);
});

export default router;
