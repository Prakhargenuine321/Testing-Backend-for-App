// server.js
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import multer from "multer";

const app = express();
app.use(cors());
app.use(express.json());

// --- Debug: Log environment variables (hide passwords) ---
console.log("🔍 Environment check:");
console.log("  SMTP_HOST:", process.env.SMTP_HOST || "❌ NOT SET");
console.log("  SMTP_PORT:", process.env.SMTP_PORT || "❌ NOT SET");
console.log("  SMTP_USER:", process.env.SMTP_USER || "❌ NOT SET");
console.log("  SMTP_PASS:", process.env.SMTP_PASS ? "✅ SET" : "❌ NOT SET");
console.log("  MAIL_FROM:", process.env.MAIL_FROM || process.env.SMTP_USER || "❌ NOT SET");
console.log("  MAIL_TO:", process.env.MAIL_TO || process.env.RECEIVER_EMAIL || "❌ NOT SET");

// --- Transporter ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // STARTTLS on 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Add timeout to fail faster
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Verify transporter on boot
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP verify failed:", err.message);
    console.error("   Full error:", err);
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
    console.error("Health check failed:", e);
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
  console.log("📨 Received email request");
  
  try {
    const { name, contactNumber, area, locality, wasteType, wasteAmount, location } = req.body || {};
    
    console.log("📋 Form data:", { name, contactNumber, area, locality, wasteType, wasteAmount, location: location ? "present" : "missing" });
    
    if (!name || !contactNumber || !area || !locality || !wasteType || !wasteAmount || !location) {
      console.log("❌ Missing required fields");
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Handle images
    const files = req.files || [];
    console.log(`📎 Attachments: ${files.length} file(s)`);
    
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
      console.error("❌ Email addresses not configured");
      return res.status(500).json({
        success: false,
        message: "Server not configured: set MAIL_FROM and MAIL_TO",
      });
    }

    // Parse location
    let locationString;
    let googleMapsUrl;
    
    try {
      const locationData = typeof location === 'string' ? JSON.parse(location) : location;
      
      if (typeof locationData === 'object' && locationData !== null) {
        if (locationData.lat !== undefined && locationData.lng !== undefined) {
          locationString = `${locationData.lat}, ${locationData.lng}`;
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${locationData.lat},${locationData.lng}`;
        } else {
          locationString = JSON.stringify(locationData);
          googleMapsUrl = null;
        }
      } else {
        locationString = String(locationData);
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`;
      }
    } catch (e) {
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

    console.log(`📧 Sending email from ${fromAddress} to ${toAddress}...`);
    
    const startTime = Date.now();
    await transporter.sendMail({
      from: `"Form Bot" <${fromAddress}>`,
      to: toAddress,
      subject: "New Form Submission",
      text,
      html,
      attachments,
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Email sent successfully in ${duration}ms`);

    res.json({ success: true, message: "Email sent" });
  } catch (err) {
    console.error("❌ Send error:", err.message);
    console.error("   Error code:", err.code);
    console.error("   Error response:", err.response);
    console.error("   Full error:", err);
    
    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: err?.message || String(err),
      code: err?.code,
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
