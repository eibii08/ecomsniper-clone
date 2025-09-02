import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const EBAY_TOKEN = "v^1.1#i^1#p^3#I^3#r^0#f^0#t^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";

// statische Dateien aus dem extension-Ordner bereitstellen (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, "../extension")));

// Root-Route → popup.html ausliefern
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../extension/popup.html"));
});

// Beispiel-API (dein eBay-Code)
app.get("/payment-policies", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=EBAY_DE",
      {
        headers: {
          Authorization: `Bearer ${EBAY_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
