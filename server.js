import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());
app.use(cors());

// test route
app.get("/", (req, res) => {
  res.send("🚀 Backend running on Render!");
});

// email route
app.post("/send-email", async (req, res) => {
  const { name, phone, location } = req.body;

  if (!name || !phone || !location) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    // 🔑 configure transporter
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail
        pass: process.env.EMAIL_PASS, // app password
      },
    });

    // 📩 send email
    await transporter.sendMail({
      from: `"My App" <${process.env.EMAIL_USER}>`,
      to: process.env.RECEIVER_EMAIL, // owner email
      subject: "New Form Submission",
      text: `Name: ${name}\nPhone: ${phone}\nLocation: ${location}`,
    });

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});

// render port handling
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
