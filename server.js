import express from "express";
import cors from "cors";
import emailjs from "emailjs-com";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🚀 Backend is running fine!");
});


app.post("/send-email", (req, res) => {
  const { name, phone, location } = req.body;

  emailjs
    .send(
      "service_pu3uyoj",   // from EmailJS dashboard
      "template_tg4mh64",  // from template
      { name, phone, location },
      "jIFhfIgtMu7lXYAqP"    // from EmailJS API keys
    )
    .then(() => {
      res.json({ success: true });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ success: false, error: err });
    });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
