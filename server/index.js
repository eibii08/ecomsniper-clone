// server/index.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- config / env ----
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || "";
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || "";
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI || ""; // exakt wie in dev account
const MARKETPLACE = process.env.EBAY_MARKETPLACE || "EBAY_DE";
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

// ---- helpers: store ----
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("ensureDataDir:", e);
  }
}
async function readStore() {
  await ensureDataDir();
  try {
    const txt = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(txt || "{}");
  } catch (e) {
    return {};
  }
}
async function writeStore(obj) {
  await ensureDataDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(obj, null, 2));
}

// ---- token utilities ----
async function refreshAccessToken(refreshToken) {
  const auth = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const resp = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Refresh token failed: ${JSON.stringify(data)}`);
  }

  const store = await readStore();
  store.access_token = data.access_token;
  store.refresh_token = data.refresh_token || store.refresh_token;
  store.expires_at = Date.now() + (data.expires_in || 7200) * 1000;
  await writeStore(store);
  return store;
}

async function getAccessTokenOrThrow() {
  const store = await readStore();
  if (store.access_token && store.expires_at && Date.now() < store.expires_at - 60000) {
    return store.access_token;
  }
  if (store.refresh_token) {
    const updated = await refreshAccessToken(store.refresh_token);
    return updated.access_token;
  }
  throw new Error("No access token available. Authenticate via /auth");
}

// ---- express app ----
const app = express();
app.use(cors()); // dev-friendly; in production einschränken
app.use(express.json());

// serve extension files so popup.html is reachable if requested
app.use(express.static(path.join(__dirname, "../extension")));

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Start OAuth flow -> redirect to eBay
app.get("/auth", (_req, res) => {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REDIRECT_URI) {
    return res
      .status(500)
      .send("Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET / EBAY_REDIRECT_URI in env");
  }

  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
    "https://api.ebay.com/oauth/api_scope/sell.marketing",
  ].join(" ");

  const authUrl = new URL("https://auth.ebay.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", EBAY_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", EBAY_REDIRECT_URI);
  authUrl.searchParams.set("scope", scopes);

  res.redirect(authUrl.toString());
});

// Callback - exchange code for tokens and save refresh token
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: "Missing code in callback" });

  try {
    const auth = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: EBAY_REDIRECT_URI,
    });

    const tokenResp = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error("Token exchange failed:", tokenData);
      return res.status(400).json({ error: "Token exchange failed", details: tokenData });
    }

    // store tokens
    const store = await readStore();
    store.access_token = tokenData.access_token;
    store.refresh_token = tokenData.refresh_token;
    store.expires_at = Date.now() + (tokenData.expires_in || 7200) * 1000;
    await writeStore(store);

    return res.send(
      `<h2>Erfolgreich autorisiert ✅</h2>
      <p>Access token gespeichert (läuft ab in ${tokenData.expires_in} s).</p>
      <p>Du kannst dieses Fenster schließen und im Popup weiterarbeiten.</p>`
    );
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).json({ error: "Callback error", details: err.message });
  }
});

// --- GET policies (payment / return / fulfillment) ---
app.get("/api/ebay/policies", async (req, res) => {
  try {
    const token = await getAccessTokenOrThrow();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const [paymentR, returnR, fulfillR] = await Promise.all([
      fetch(`https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE}`, { headers }),
      fetch(`https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE}`, { headers }),
      fetch(`https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE}`, { headers }),
    ]);

    const payment = await paymentR.json();
    const returns = await returnR.json();
    const fulfillment = await fulfillR.json();

    res.json({ payment, returns, fulfillment });
  } catch (err) {
    console.error("/api/ebay/policies err:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET inventory locations (merchantLocationKey list) ---
app.get("/api/ebay/locations", async (req, res) => {
  try {
    const token = await getAccessTokenOrThrow();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const r = await fetch(`https://api.ebay.com/sell/inventory/v1/location`, { headers });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("/api/ebay/locations err:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- POST create listing: create inventory_item -> create offer -> (optional) publish ---
/*
 expected body:
 {
   sku (optional),
   title,
   description,
   price, // string or number
   quantity,
   images: [url,...],
   categoryId (required for publish),
   merchantLocationKey (required for publish),
   paymentPolicyId, returnPolicyId, fulfillmentPolicyId (optional; if not given, server will try to auto-select first ones)
 }
*/
app.post("/api/listings/create", async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.title || !body.price) {
      return res.status(400).json({ error: "Missing title or price in payload" });
    }

    // sku generation
    const sku = body.sku || `SNIP-${Date.now()}`;

    // prepare inventory item payload (createOrReplaceInventoryItem)
    const inventoryPayload = {
      product: {
        title: body.title,
        description: body.description || body.title,
        imageUrls: body.images || [],
        aspects: body.aspects || {},
      },
      availability: {
        shipToLocationAvailability: {
          quantity: Number(body.quantity || 1),
        },
      },
    };

    const token = await getAccessTokenOrThrow();
    const headersBase = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // 1) create/replace inventory item
    const invResp = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      method: "PUT",
      headers: headersBase,
      body: JSON.stringify(inventoryPayload),
    });
    const invText = await invResp.text().catch(() => "");
    let invJson = null;
    try { invJson = invText ? JSON.parse(invText) : null; } catch(e){ invJson = { raw: invText }; }

    if (!invResp.ok && invResp.status !== 204 && invResp.status !== 200) {
      return res.status(400).json({ step: "create_inventory_item", status: invResp.status, body: invJson });
    }

    // 2) attempt to determine policies if not provided
    let paymentPolicyId = body.paymentPolicyId;
    let returnPolicyId = body.returnPolicyId;
    let fulfillmentPolicyId = body.fulfillmentPolicyId;

    if (!paymentPolicyId || !returnPolicyId || !fulfillmentPolicyId) {
      const policyResp = await fetch(`https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE}`, { headers: headersBase });
      const payments = await policyResp.json().catch(()=>null);
      if (payments && payments.paymentPolicies && payments.paymentPolicies.length) paymentPolicyId = paymentPolicyId || payments.paymentPolicies[0].paymentPolicyId;

      const retResp = await fetch(`https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE}`, { headers: headersBase });
      const returns = await retResp.json().catch(()=>null);
      if (returns && returns.returnPolicies && returns.returnPolicies.length) returnPolicyId = returnPolicyId || returns.returnPolicies[0].returnPolicyId;

      const fulResp = await fetch(`https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE}`, { headers: headersBase });
      const fulf = await fulResp.json().catch(()=>null);
      if (fulf && fulf.fulfillmentPolicies && fulf.fulfillmentPolicies.length) fulfillmentPolicyId = fulfillmentPolicyId || fulf.fulfillmentPolicies[0].fulfillmentPolicyId;
    }

    // 3) create offer payload
    const offerPayload = {
      sku,
      marketplaceId: MARKETPLACE,
      // categoryId is required to publish; we still create offer without it but publishing will fail without it.
      categoryId: body.categoryId || undefined,
      format: "FIXED_PRICE",
      availableQuantity: Number(body.quantity || 1),
      listingDescription: body.description || body.title,
      pricingSummary: {
        price: {
          value: String(body.price),
          currency: body.currency || "EUR",
        },
      },
      listingPolicies:
        paymentPolicyId && returnPolicyId && fulfillmentPolicyId
          ? {
              paymentPolicyId,
              returnPolicyId,
              fulfillmentPolicyId,
            }
          : undefined,
      merchantLocationKey: body.merchantLocationKey || undefined,
      listingDuration: body.listingDuration || "GTC",
    };

    const offerResp = await fetch(`https://api.ebay.com/sell/inventory/v1/offer`, {
      method: "POST",
      headers: headersBase,
      body: JSON.stringify(offerPayload),
    });

    const offerJson = await offerResp.json().catch(()=>null);
    if (!offerResp.ok) {
      return res.status(400).json({ step: "create_offer", status: offerResp.status, body: offerJson });
    }

    const offerId = offerJson.offerId;

    // 4) optionally publish if merchantLocationKey, categoryId and listingPolicies are present
    let publishResult = null;
    if (offerId && offerPayload.merchantLocationKey && offerPayload.listingPolicies && offerPayload.categoryId) {
      const pubResp = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
        method: "POST",
        headers: headersBase,
        body: JSON.stringify({ marketplaceId: MARKETPLACE }),
      });
      const pubJson = await pubResp.json().catch(()=>null);
      publishResult = { status: pubResp.status, body: pubJson };
      if (!pubResp.ok) {
        // return info but don't fail silently
        return res.status(400).json({ step: "publish_offer", offerId, publishResult });
      }
    } else {
      publishResult = { notice: "Publish skipped - missing merchantLocationKey/categoryId/listingPolicies. Use /api/ebay/policies and /api/ebay/locations to fill them." };
    }

    // store a small log
    const store = await readStore();
    store.lastListing = { sku, offerId, title: body.title, createdAt: new Date().toISOString() };
    await writeStore(store);

    res.json({ step: "done", sku, offerId, publishResult });
  } catch (err) {
    console.error("/api/listings/create err:", err);
    res.status(500).json({ error: err.message });
  }
});

// small helper to see stored tokens (only for dev; remove in prod)
app.get("/api/store", async (req, res) => {
  const store = await readStore();
  // do not leak secrets in production; this is dev helper
  const safe = { ...store };
  if (safe.access_token) safe.access_token = "[REDACTED]";
  if (safe.refresh_token) safe.refresh_token = "[REDACTED]";
  res.json(safe);
});

// fallback - serve extension popup by default
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../extension/popup.html"));
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
