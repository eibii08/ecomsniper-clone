import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Redirect zu eBay OAuth
router.get("/", (_req, res) => {
  const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${process.env.EBAY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.EBAY_REDIRECT_URI)}&scope=${encodeURIComponent(process.env.EBAY_SCOPES)}`;
  res.redirect(authUrl);
});

// Callback von eBay
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Missing code in callback" });

  try {
    const pair = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.EBAY_REDIRECT_URI,
    });

    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${pair}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = await response.json();
    // Token speichern: hier nur Demo
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
