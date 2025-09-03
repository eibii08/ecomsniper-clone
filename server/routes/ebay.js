import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Fetch Payment / Return / Fulfillment Policies
router.get("/policies", async (_req, res) => {
  try {
    // TODO: Token dynamisch einfügen
    const token = process.env.EBAY_APP_TOKEN;

    const r = await fetch("https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=EBAY_DE", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payment = await r.json();

    const r2 = await fetch("https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=EBAY_DE", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const returns = await r2.json();

    const r3 = await fetch("https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_DE", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const fulfillment = await r3.json();

    res.json({ payment, returns, fulfillment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch Merchant Locations
router.get("/locations", async (_req, res) => {
  try {
    const token = process.env.EBAY_APP_TOKEN;
    const r = await fetch("https://api.ebay.com/sell/account/v1/merchant_location", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
