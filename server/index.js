import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import bodyParser from "body-parser";

// __dirname für ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// -------------------- CONFIG --------------------
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.EBAY_CLIENT_ID; // z.B. TobiasEi-app-PRD-fbd83919c-1c51a023
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET; // z.B. PRD-bd83919ce0d2-ea0c-450f-822c-a877
const REDIRECT_URI = process.env.EBAY_REDIRECT_URI; // z.B. https://meine-app.eu/callback
let accessToken = null;
let tokenExpiry = null;

// CORS konfigurieren
const allowedOrigins = [
  "https://meine-app.eu",
  "https://www.meine-app.eu",
  "https://ecomsniper-clone.onrender.com"
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: false
}));

// -------------------- STATIC FILES --------------------
app.use(express.static(path.join(__dirname, "../extension")));

// -------------------- HEALTHCHECK --------------------
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// -------------------- HOMEPAGE --------------------
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../extension/popup.html"));
});

// -------------------- OAUTH FLOW --------------------
// 1. Redirect to eBay login
app.get("/auth", (_req, res) => {
  const clientId = process.env.EBAY_CLIENT_ID;
  const redirectUri = "Tobias_Eibl-TobiasEi-app-PR-vzfvzbzki"; // Dein RuName
  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.inventory"
  ].join(" "); // Leerzeichen-getrennt

  const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes)}`;
  res.redirect(authUrl);
});


// 2. Callback, exchange code for access_token
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const body = new URLSearchParams();
  body.append("grant_type", "authorization_code");
  body.append("code", code);
  body.append("redirect_uri", REDIRECT_URI);

  try {
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    const data = await response.json();
    if (data.access_token) {
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000); // Timestamp in ms
      res.send("Authorization erfolgreich! Du kannst jetzt Produkte posten.");
    } else {
      res.status(500).json(data);
    }
  } catch (err) {
    console.error("Callback Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------- PAYMENT POLICIES --------------------
app.get("/payment-policies", async (_req, res) => {
  if (!accessToken || Date.now() > tokenExpiry) return res.status(401).json({ error: "Token expired oder nicht vorhanden" });

  try {
    const response = await fetch("https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=EBAY_DE", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- POST PRODUCT --------------------
app.post("/post-product", async (req, res) => {
  if (!accessToken || Date.now() > tokenExpiry) return res.status(401).json({ error: "Token expired oder nicht vorhanden" });

  const { title, price, quantity, description, imageUrls } = req.body;
  if (!title || !price || !quantity) return res.status(400).json({ error: "title, price, quantity required" });

  try {
    // 1. Inventory Item erstellen
    const inventoryItem = {
      sku: `SNIPER-${Date.now()}`,
      product: { title, description, aspects: {} },
      condition: "NEW",
      availability: { shipToLocationAvailability: { quantity: quantity } },
      packageWeightAndSize: { weight: { value: 0.5, unit: "KG" } }
    };
    if (imageUrls?.length) inventoryItem.product.imageUrls = imageUrls;

    const itemResp = await fetch("https://api.ebay.com/sell/inventory/v1/inventory_item/SNIPER-12345", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(inventoryItem)
    });

    const itemData = await itemResp.json();

    // 2. Offer erstellen
    const offer = {
      sku: inventoryItem.sku,
      marketplaceId: "EBAY_DE",
      format: "FIXED_PRICE",
      availableQuantity: quantity,
      listingDescription: description,
      pricingSummary: { price: { value: price, currency: "EUR" } }
    };
    const offerResp = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${inventoryItem.sku}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(offer)
    });
    const offerData = await offerResp.json();

    res.json({ inventory: itemData, offer: offerData });
  } catch (err) {
    console.error("Post Product Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------- SERVER START --------------------
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
