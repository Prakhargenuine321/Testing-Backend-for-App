// server.js
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(express.json());

// --- Transporter (choose one provider) ---
// Option A: Brevo (Sendinblue) SMTP (recommended: easy, API key as password)
//   SMTP_HOST=smtp-relay.brevo.com
//   SMTP_PORT=587
//   SMTP_USER=your-brevo-login (often your email)
//   SMTP_PASS=your-brevo-API-key
//
// Option B: Gmail (requires 2FA + App Password; not your normal password)
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=yourgmail@gmail.com
//   SMTP_PASS=your-16-char-app-password

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // STARTTLS on 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter on boot (shows clear logs in Render)
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP verify failed:", err.message);
  } else {
    console.log("✅ SMTP ready:", success);
  }
});

// Health checks
app.get("/", (_req, res) => res.send("🚀 Backend running"));
app.get("/health", async (_req, res) => {
  try {
    await transporter.verify();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Main endpoint
app.post("/send-email", async (req, res) => {
  try {
    const { name, contactNumber, area, locality, wasteType, wasteAmount, location } = req.body || {};
    if (!name || !contactNumber || !area || !locality || !wasteType || !wasteAmount || !location) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields: name/contactNumber/area/locality/wasteType/wasteAmount/location" });
    }

    const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER;
    const toAddress = process.env.MAIL_TO || process.env.RECEIVER_EMAIL;

    if (!fromAddress || !toAddress) {
      return res.status(500).json({
        success: false,
        message: "Server not configured: set MAIL_FROM and MAIL_TO (or RECEIVER_EMAIL)",
      });
    }

    const text = `New submission:
- Name: ${name}
- Contact Number: ${contactNumber}
- Area: ${area}
- Locality: ${locality}
- Type Of Waste: ${wasteType}
- Amount Of Waste: ${wasteAmount}
- Location: ${location}`;

    const html = `
      <h2>New submission</h2>
      <ul>
        <li><b>Name:</b> ${name}</li>
        <li><b>Contact Number:</b> ${contactNumber}</li>
        <li><b>Area:</b> ${area}</li>
        <li><b>Locality:</b> ${locality}</li>
        <li><b>Type Of Waste:</b> ${wasteType}</li>
        <li><b>Amount Of Waste:</b> ${wasteAmount}</li>
        <li><b>Location:</b> ${location}</li>
      </ul>
    `;

    await transporter.sendMail({
      from: `"Form Bot" <${fromAddress}>`,
      to: toAddress,
      subject: "New Form Submission",
      text,
      html,
    });

    res.json({ success: true, message: "Email sent" });
  } catch (err) {
    console.error("❌ Send error:", err && err.response ? err.response : err);
    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: err?.message || String(err),
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
