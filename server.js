import express from "express";
import cors from "cors";
import emailjs from "emailjs-com";

const app = express();
app.use(express.json());
app.use(cors());

// test route
app.get("/", (req, res) => {
  res.send("🚀 Backend running on Render!");
});

// your email route
app.post("/send-email", (req, res) => {
  const { name, phone, location } = req.body;

  emailjs
    .send("SERVICE_ID", "TEMPLATE_ID", { name, phone, location }, "PUBLIC_KEY")
    .then(() => res.send({ success: true }))
    .catch((err) => res.status(500).send(err));
});

// 🔑 important change
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
