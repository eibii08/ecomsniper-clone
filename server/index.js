import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

// __dirname für ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Port & eBay Token
const PORT = process.env.PORT || 3000;
const EBAY_TOKEN = process.env.EBAY_TOKEN; // In Render als Environment Variable setzen

// CORS konfigurieren: nur deine Domains erlauben
const allowedOrigins = [
  "https://meine-app.eu",
  "https://www.meine-app.eu",
  "https://ecomsniper-clone.onrender.com"
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: false
  })
);

// Statische Dateien aus dem Extension-Ordner
app.use(express.static(path.join(__dirname, "../extension")));

// Healthcheck Endpoint
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Homepage → popup.html ausliefern
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../extension/popup.html"));
});

// eBay Payment Policies Endpoint
app.get("/payment-policies", async (_req, res) => {
  try {
    if (!EBAY_TOKEN) {
      return res.status(500).json({ error: "EBAY_TOKEN ist nicht gesetzt" });
    }

    const url = "https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=EBAY_DE";
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${EBAY_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";

    console.log("[eBay] Status:", response.status);
    console.log("[eBay] Body:", text);

    res.status(response.status);
    if (contentType.includes("application/json")) {
      res.setHeader("Content-Type", "application/json");
      return res.send(text);
    } else {
      return res.send(text);
    }
  } catch (err) {
    console.error("Fehler /payment-policies:", err);
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
});

// Weitere eBay Endpoints vorbereiten (optional)
// z.B. Versand-Policies
app.get("/shipping-policies", async (_req, res) => {
  try {
    const url = "https://api.ebay.com/sell/account/v1/shipping_policy";
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${EBAY_TOKEN}`, "Content-Type": "application/json" },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
