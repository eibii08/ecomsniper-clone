import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- Health Endpoint ---
app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// --- OAuth Start ---
app.get("/auth", (_req, res) => {
  const clientId = process.env.EBAY_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.EBAY_REDIRECT_URI);
  const scopes = [
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
  ].join(" ");

  const url = `https://auth.ebay.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes)}`;
  res.redirect(url);
});

// --- OAuth Callback ---
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Code not found");

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const redirectUri = process.env.EBAY_REDIRECT_URI;

  const pair = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const tokenResp = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${pair}`,
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    });

    const tokenData = await tokenResp.json();
    // tokenData enthält access_token, expires_in etc.
    res.json(tokenData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Token exchange failed", details: err.message });
  }
});

// --- Policies Endpoint (Platzhalter) ---
app.get("/api/ebay/policies", (_req, res) => {
  res.json({
    payment: { paymentPolicies: [{ paymentPolicyId: "123", name: "PayPal Standard" }] },
    fulfillment: { fulfillmentPolicies: [{ fulfillmentPolicyId: "456", name: "Standard Shipping" }] },
    returns: { returnPolicies: [{ returnPolicyId: "789", name: "14 Tage Rückgabe" }] },
  });
});

// --- Locations Endpoint (Platzhalter) ---
app.get("/api/ebay/locations", (_req, res) => {
  res.json({
    locations: [{ merchantLocationKey: "LOC1", name: "Deutschland", merchantLocationStatus: "Active" }],
  });
});

// --- Listing Endpoint (Platzhalter) ---
app.post("/api/listings/create", (req, res) => {
  const payload = req.body;
  console.log("Listing Payload:", payload);
  // Hier würdest du eBay Inventory + Offer + Publish API aufrufen
  res.json({ ok: true, offerId: "OFFER12345" });
});

// ============= EBAY API Helper =================
async function ebayApi(path, method, token, body) {
  const res = await fetch(`https://api.ebay.com${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

// ============= ROUTE: Create Listing ===========
app.post("/api/listings/create", async (req, res) => {
  try {
    const { access_token } = req.body; // später: aus DB holen
    if (!access_token) return res.status(400).json({ error: "Missing access_token" });

    const { sku, title, description, price, currency, quantity, images, merchantLocationKey, paymentPolicyId, returnPolicyId, fulfillmentPolicyId } = req.body;

    // 1) InventoryItem erstellen
    const inventoryPayload = {
      sku,
      product: {
        title,
        description,
        aspects: {}, // später: Kategorien & Spezifikationen
        imageUrls: images || [],
      },
      availability: {
        shipToLocationAvailability: {
          quantity: quantity || 1,
        },
      },
    };

    await ebayApi(`/sell/inventory/v1/inventory_item/${sku}`, "PUT", access_token, inventoryPayload);

    // 2) Offer erstellen
    const offerPayload = {
      sku,
      marketplaceId: "EBAY_DE",
      format: "FIXED_PRICE",
      availableQuantity: quantity || 1,
      pricingSummary: {
        price: { value: price, currency: currency || "EUR" },
      },
      listingPolicies: {
        paymentPolicyId,
        returnPolicyId,
        fulfillmentPolicyId,
      },
      merchantLocationKey,
    };

    const offerRes = await ebayApi(`/sell/inventory/v1/offer`, "POST", access_token, offerPayload);

    // 3) Offer publish
    const publishRes = await ebayApi(`/sell/inventory/v1/offer/${offerRes.offerId}/publish`, "POST", access_token);

    res.json({ ok: true, offerId: offerRes.offerId, publishRes });
  } catch (err) {
    console.error("Listing error:", err.message);
    res.status(500).json({ error: "Listing failed", details: err.message });
  }
});

// ============= ROUTE: Policies holen ===========
app.get("/api/ebay/policies", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: "Missing access_token" });

    const [payment, fulfillment, returns] = await Promise.all([
      ebayApi(`/sell/account/v1/payment_policy?marketplace_id=EBAY_DE`, "GET", token),
      ebayApi(`/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_DE`, "GET", token),
      ebayApi(`/sell/account/v1/return_policy?marketplace_id=EBAY_DE`, "GET", token),
    ]);

    res.json({ payment, fulfillment, returns });
  } catch (err) {
    res.status(500).json({ error: "Policies fetch failed", details: err.message });
  }
});

// ============= ROUTE: Locations holen ===========
app.get("/api/ebay/locations", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: "Missing access_token" });

    const locations = await ebayApi(`/sell/inventory/v1/location`, "GET", token);
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: "Locations fetch failed", details: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
