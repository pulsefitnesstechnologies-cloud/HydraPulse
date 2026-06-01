import { Router } from "express";

const router = Router();

const EFFECTIVE_DATE = "June 1, 2026";
const CONTACT_EMAIL = "pulsefitnesstechnologies@gmail.com";

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — HydraPulse</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1a1a2e;
      background: #f8fafc;
    }
    header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #fff;
      padding: 48px 24px 40px;
      text-align: center;
    }
    .brand {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #38bdf8;
      margin-bottom: 16px;
    }
    header h1 {
      font-size: clamp(24px, 5vw, 36px);
      font-weight: 700;
      margin-bottom: 10px;
    }
    .effective {
      font-size: 14px;
      color: #94a3b8;
    }
    main {
      max-width: 720px;
      margin: 0 auto;
      padding: 40px 24px 64px;
    }
    section { margin-bottom: 36px; }
    h2 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    p { margin-bottom: 14px; color: #334155; }
    ul {
      list-style: none;
      margin-bottom: 14px;
    }
    ul li {
      padding: 6px 0 6px 22px;
      position: relative;
      color: #334155;
    }
    ul li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 15px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #38bdf8;
    }
    .callout {
      background: #f0f9ff;
      border-left: 4px solid #38bdf8;
      padding: 16px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 14px;
    }
    .callout p { margin: 0; color: #0c4a6e; }
    .warning {
      background: #fef9c3;
      border-left: 4px solid #eab308;
      padding: 16px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 14px;
    }
    .warning p { margin: 0; color: #713f12; }
    a { color: #0284c7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer {
      text-align: center;
      padding: 32px 24px;
      font-size: 13px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    nav {
      display: flex;
      justify-content: center;
      gap: 24px;
      padding: 16px 24px;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
    }
    nav a { font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <div class="brand">HydraPulse</div>
    <h1>${title}</h1>
    <p class="effective">Effective ${EFFECTIVE_DATE}</p>
  </header>
  <nav>
    <a href="/api/privacy">Privacy Policy</a>
    <a href="/api/terms">Terms of Service</a>
  </nav>
  <main>${body}</main>
  <footer>
    &copy; ${new Date().getFullYear()} HydraPulse &nbsp;·&nbsp;
    Questions? <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
  </footer>
</body>
</html>`;
}

const privacyBody = `
<section>
  <div class="callout">
    <p><strong>Short version:</strong> HydraPulse stores all your data locally on your device. We never upload your health data, never track you, and never sell your information.</p>
  </div>
</section>

<section>
  <h2>What HydraPulse Does</h2>
  <p>HydraPulse estimates your hydration status using photoplethysmography (PPG) — analysis of heart rate and heart rate variability signals from your iPhone's rear camera or Apple Watch. All processing happens on-device in real time.</p>
</section>

<section>
  <h2>Data We Store on Your Device</h2>
  <p>The following data is stored locally on your device using Apple's AsyncStorage and is never transmitted to any server:</p>
  <ul>
    <li>Scan results — hydration score, heart rate, HRV, confidence, timestamp, and scan method</li>
    <li>Water intake logs — amount and time of each log entry</li>
    <li>Daily hydration goal (oz)</li>
    <li>Onboarding completion state</li>
    <li>Notification preferences and schedules</li>
    <li>App settings and scan mode preferences</li>
  </ul>
  <p>You can delete all stored data at any time from <strong>Settings → Clear All History</strong>. Uninstalling the app removes all locally stored data permanently.</p>
</section>

<section>
  <h2>Apple HealthKit</h2>
  <p>On iOS, HydraPulse can connect to Apple Health with your explicit permission. We handle HealthKit data as follows:</p>
  <ul>
    <li><strong>We read:</strong> Heart Rate, Heart Rate Variability (HRV), and Resting Heart Rate — used only to compute your hydration score</li>
    <li><strong>We write:</strong> Dietary Water (when you log water intake and choose to sync to Health)</li>
    <li><strong>We never:</strong> upload HealthKit data to any server, share it with third parties, or use it for advertising or analytics</li>
  </ul>
  <p>HealthKit data is processed entirely on your device. You can revoke access at any time in <strong>iPhone Settings → Privacy &amp; Security → Health → HydraPulse</strong>.</p>
</section>

<section>
  <h2>Camera</h2>
  <p>Camera access is used exclusively during an active PPG scan. During a scan, the camera captures live light-intensity readings to detect subtle changes in blood volume. No video, images, or frames are recorded, saved to your device, or uploaded anywhere. The camera feed is processed in real time and discarded immediately after the scan completes.</p>
</section>

<section>
  <h2>Notifications</h2>
  <p>All reminders and alarms are scheduled locally on your device using iOS's notification system. HydraPulse does not operate a push notification server. Notification preferences are stored on-device and are never transmitted externally.</p>
</section>

<section>
  <h2>Data We Do Not Collect</h2>
  <ul>
    <li>No user accounts or registration</li>
    <li>No IP addresses or device identifiers</li>
    <li>No analytics or crash reporting</li>
    <li>No advertising SDKs</li>
    <li>No usage tracking or behavioral profiling</li>
    <li>No location data</li>
    <li>No biometric data beyond what is processed transiently during a scan</li>
  </ul>
</section>

<section>
  <h2>Third-Party Services</h2>
  <p>HydraPulse does not integrate any third-party analytics, advertising, or data-collection SDKs. The only third-party platform involved is Apple's HealthKit, which operates under <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noopener">Apple's Privacy Policy</a>.</p>
</section>

<section>
  <h2>Children</h2>
  <p>HydraPulse is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has used the app and has concerns about privacy, please contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
</section>

<section>
  <h2>Your Rights</h2>
  <p>Because all data is stored locally on your device, you have full control at all times:</p>
  <ul>
    <li><strong>Access:</strong> All data is visible within the app on the History screen</li>
    <li><strong>Delete:</strong> Settings → Clear All History removes all scan and water log data</li>
    <li><strong>HealthKit access:</strong> Revocable at any time in iOS Settings</li>
    <li><strong>Notifications:</strong> Revocable at any time in iOS Settings → Notifications → HydraPulse</li>
  </ul>
</section>

<section>
  <h2>Changes to This Policy</h2>
  <p>If we make material changes to this privacy policy, we will update the effective date above and, where appropriate, notify users via an in-app message. Continued use of HydraPulse after changes are posted constitutes acceptance of the revised policy.</p>
</section>

<section>
  <h2>Contact</h2>
  <p>Questions or concerns about privacy? Contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
</section>

<section>
  <div class="warning">
    <p><strong>Medical Disclaimer:</strong> HydraPulse provides hydration estimates for general wellness purposes only. It is not a medical device and is not intended to diagnose, treat, cure, or prevent any health condition. Always consult a qualified healthcare provider for medical advice.</p>
  </div>
</section>
`;

const termsBody = `
<section>
  <div class="callout">
    <p><strong>Short version:</strong> HydraPulse is a wellness tool, not a medical device. Use it for general awareness, not medical decisions. Be 13 or older to use it.</p>
  </div>
</section>

<section>
  <h2>Acceptance of Terms</h2>
  <p>By downloading or using HydraPulse, you agree to these Terms of Service. If you do not agree, please do not use the app.</p>
</section>

<section>
  <h2>Eligibility</h2>
  <p>You must be at least 13 years of age to use HydraPulse. By using the app, you represent that you meet this requirement.</p>
</section>

<section>
  <h2>Not a Medical Device</h2>
  <div class="warning">
    <p>HydraPulse is a general wellness application. It is <strong>not</strong> a medical device, and its hydration estimates are <strong>not</strong> a substitute for professional medical advice, diagnosis, or treatment. Do not make medical decisions based on HydraPulse results.</p>
  </div>
  <p>The PPG-based hydration estimates are experimental and based on correlations between cardiovascular signals and hydration status. Individual results vary and may not accurately reflect your actual hydration state.</p>
</section>

<section>
  <h2>Permitted Use</h2>
  <p>HydraPulse is provided for your personal, non-commercial use. You agree not to:</p>
  <ul>
    <li>Reverse-engineer, decompile, or disassemble the app</li>
    <li>Use the app for any unlawful purpose</li>
    <li>Attempt to gain unauthorized access to any part of the app or its infrastructure</li>
    <li>Redistribute or resell the app or its content</li>
  </ul>
</section>

<section>
  <h2>Intellectual Property</h2>
  <p>All content, design, and functionality of HydraPulse — including but not limited to text, graphics, algorithms, and code — is the property of HydraPulse and is protected by applicable intellectual property laws.</p>
</section>

<section>
  <h2>Disclaimer of Warranties</h2>
  <p>HydraPulse is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the app will be error-free, uninterrupted, or produce accurate results in all circumstances.</p>
</section>

<section>
  <h2>Limitation of Liability</h2>
  <p>To the maximum extent permitted by law, HydraPulse and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of — or inability to use — the app, even if advised of the possibility of such damages.</p>
</section>

<section>
  <h2>Apple HealthKit Terms</h2>
  <p>If you use HealthKit integration, you acknowledge that HydraPulse reads and optionally writes health data solely for the purposes described in our <a href="/api/privacy">Privacy Policy</a>. HealthKit data will not be used for advertising, sold to data brokers, or disclosed to third parties except as required by law.</p>
</section>

<section>
  <h2>Changes to These Terms</h2>
  <p>We may update these terms from time to time. We will notify you of material changes via an in-app notice or by updating the effective date above. Continued use of the app after changes are posted constitutes acceptance.</p>
</section>

<section>
  <h2>Governing Law</h2>
  <p>These terms are governed by the laws of the jurisdiction in which HydraPulse is operated, without regard to its conflict of law provisions.</p>
</section>

<section>
  <h2>Contact</h2>
  <p>Questions about these terms? Contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
</section>
`;

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(page("Privacy Policy", privacyBody));
});

router.get("/terms", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(page("Terms of Service", termsBody));
});

export default router;
