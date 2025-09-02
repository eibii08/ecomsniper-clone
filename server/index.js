import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Healthcheck
app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ✅ Startet den Auth-Flow: weiter zu eBay
app.get("/auth", (_req, res) => {
  const clientId = process.env.EBAY_CLIENT_ID;
  const redirectUri = "Tobias_Eibl-TobiasEi-app-PR-vzfvzbzki"; // dein RuName
  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
    "https://api.ebay.com/oauth/api_scope/sell.marketing",
  ].join(" ");

  const authUrl = new URL("https://auth.ebay.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);

  res.redirect(authUrl.toString());
});

// ✅ Callback – tauscht Code gegen Access Token
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Missing code from eBay" });
  }

  try {
    const tokenResponse = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(process.env.EBAY_CLIENT_ID + ":" + process.env.EBAY_CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "Tobias_Eibl-TobiasEi-app-PR-vzfvzbzki", // muss exakt dein RuName sein
      }),
    });

    const data = await tokenResponse.json();

    if (data.access_token) {
      res.json({
        message: "Access Token erfolgreich erhalten 🎉",
        token: data.access_token,
        expires_in: data.expires_in,
      });
    } else {
      res.status(400).json({ error: "Token request failed", details: data });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ✅ Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
