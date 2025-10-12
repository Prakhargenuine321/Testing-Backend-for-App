// server.js
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import multer from "multer";

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

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

// Main endpoint
app.post("/send-email", upload.array("images", 5), async (req, res) => {
  try {
    const { name, contactNumber, area, locality, wasteType, wasteAmount, location } = req.body || {};
    if (!name || !contactNumber || !area || !locality || !wasteType || !wasteAmount || !location) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields: name/contactNumber/area/locality/wasteType/wasteAmount/location" });
    }

    // Handle images
    const files = req.files || [];
    if (files.length > 5) {
      return res.status(400).json({ success: false, message: "Max 5 images allowed" });
    }

    // Prepare attachments for nodemailer
    const attachments = files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    }));

    const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER;
    const toAddress = process.env.MAIL_TO || process.env.RECEIVER_EMAIL;

    if (!fromAddress || !toAddress) {
      return res.status(500).json({
        success: false,
        message: "Server not configured: set MAIL_FROM and MAIL_TO (or RECEIVER_EMAIL)",
      });
    }

    // Parse location - it might be a string or an object
    let locationString;
    let googleMapsUrl;
    
    try {
      // If location is a JSON string, parse it
      const locationData = typeof location === 'string' ? JSON.parse(location) : location;
      
      if (typeof locationData === 'object' && locationData !== null) {
        // If it's an object with lat/lng
        if (locationData.lat !== undefined && locationData.lng !== undefined) {
          locationString = `${locationData.lat}, ${locationData.lng}`;
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${locationData.lat},${locationData.lng}`;
        } else {
          // Fallback: stringify the object
          locationString = JSON.stringify(locationData);
          googleMapsUrl = null;
        }
      } else {
        // It's already a string
        locationString = String(locationData);
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`;
      }
    } catch (e) {
      // If parsing fails, treat it as a plain string
      locationString = String(location);
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`;
    }

    const text = `New submission:
- Name: ${name}
- Contact Number: ${contactNumber}
- Area: ${area}
- Locality: ${locality}
- Type Of Waste: ${wasteType}
- Amount Of Waste: ${wasteAmount}
- Location: ${locationString}${googleMapsUrl ? `\n- Map: ${googleMapsUrl}` : ''}`;

    const html = `
      <h2>New submission</h2>
      <ul>
        <li><b>Name:</b> ${name}</li>
        <li><b>Contact Number:</b> ${contactNumber}</li>
        <li><b>Area:</b> ${area}</li>
        <li><b>Locality:</b> ${locality}</li>
        <li><b>Type Of Waste:</b> ${wasteType}</li>
        <li><b>Amount Of Waste:</b> ${wasteAmount}</li>
        <li><b>Location:</b> ${locationString}</li>
        ${googleMapsUrl ? `<li><b>Map:</b> <a href="${googleMapsUrl}" target="_blank">View on Google Maps</a></li>` : ''}
      </ul>
    `;

    await transporter.sendMail({
      from: `"Form Bot" <${fromAddress}>`,
      to: toAddress,
      subject: "New Form Submission",
      text,
      html,
      attachments,
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
