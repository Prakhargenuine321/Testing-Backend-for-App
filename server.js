// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch"; // Brevo API uses HTTPS requests

const app = express();
app.use(cors());
app.use(express.json());

// 🩵 Debug: Log environment variables (safe version)
console.log("🔍 Environment check (Brevo):");
console.log("  BREVO_API_KEY:", process.env.BREVO_API_KEY ? "✅ SET" : "❌ NOT SET");
console.log("  MAIL_FROM:", process.env.MAIL_FROM || "❌ NOT SET");
console.log("  MAIL_TO:", process.env.MAIL_TO || "❌ NOT SET");

// 📦 Configure file uploads (same as before)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// 🩺 Health check
app.get("/", (_req, res) => res.send("🚀 Backend running with Brevo API"));
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// 🧾 Main form submission route (kept all your previous logic)
app.post("/send-email", upload.array("images", 5), async (req, res) => {
  console.log("📨 Received email request");

  try {
    const { name, contactNumber, area, locality, wasteType, wasteAmount, location } = req.body || {};

    console.log("📋 Form data:", { name, contactNumber, area, locality, wasteType, wasteAmount, location: location ? "present" : "missing" });

    if (!name || !contactNumber || !area || !locality || !wasteType || !wasteAmount || !location) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 📎 Handle uploaded images
    const files = req.files || [];
    console.log(`📎 Attachments: ${files.length} file(s)`);

    if (files.length > 5) {
      return res.status(400).json({ success: false, message: "Maximum 5 images allowed" });
    }

    // 📍 Parse and format location
    let locationString;
    let googleMapsUrl;
    try {
      const locationData = typeof location === "string" ? JSON.parse(location) : location;
      if (typeof locationData === "object" && locationData !== null) {
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

    // 📤 Compose email data
    const fromEmail = process.env.MAIL_FROM;
    const toEmail = process.env.MAIL_TO;

    if (!fromEmail || !toEmail) {
      console.error("❌ MAIL_FROM or MAIL_TO not configured");
      return res.status(500).json({ success: false, message: "Server email settings not configured" });
    }

    const htmlContent = `
      <h2>New Waste Collection Submission</h2>
      <ul>
        <li><b>Name:</b> ${name}</li>
        <li><b>Contact Number:</b> ${contactNumber}</li>
        <li><b>Area:</b> ${area}</li>
        <li><b>Locality:</b> ${locality}</li>
        <li><b>Type of Waste:</b> ${wasteType}</li>
        <li><b>Amount of Waste:</b> ${wasteAmount}</li>
        <li><b>Location:</b> ${locationString}</li>
        ${googleMapsUrl ? `<li><b>Map:</b> <a href="${googleMapsUrl}" target="_blank">View on Google Maps</a></li>` : ""}
      </ul>
    `;

    // 🧩 Prepare attachments (convert uploaded images to Base64 for Brevo API)
    const attachments = files.map((file) => ({
      name: file.originalname,
      content: file.buffer.toString("base64"),
    }));

    // 📨 Send using Brevo API (HTTPS request)
    console.log("📧 Sending email via Brevo API...");

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Form Bot", email: fromEmail },
        to: [{ email: toEmail }],
        subject: "New Waste Collection Request",
        htmlContent,
        attachment: attachments,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Email sent successfully via Brevo");
      res.json({ success: true, message: "Email sent successfully!" });
    } else {
      console.error("❌ Brevo API error:", data);
      res.status(500).json({ success: false, message: "Brevo API failed", error: data });
    }
  } catch (err) {
    console.error("❌ Send error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
