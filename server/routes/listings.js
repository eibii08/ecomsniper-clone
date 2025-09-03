import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/create", async (req, res) => {
  const product = req.body;
  if (!product || !product.title) return res.status(400).json({ error: "Invalid product" });

  try {
    const token = process.env.EBAY_APP_TOKEN;

    // InventoryItem erstellen
    const invResp = await fetch("https://api.ebay.com/sell/inventory/v1/inventory_item/SNIP-" + Date.now(), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: product.sku,
        product: {
          title: product.title,
          description: product.description,
          aspects: {},
          imageUrls: product.images,
        },
        availability: { shipToLocationAvailability: { quantity: product.quantity } },
      }),
    });

    const invData = await invResp.json();

    // Offer erstellen
    const offerResp = await fetch("https://api.ebay.com/sell/inventory/v1/offer", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: product.sku,
        marketplaceId: "EBAY_DE",
        format: "FIXED_PRICE",
        availableQuantity: product.quantity,
        pricingSummary: { price: { value: product.price, currency: "EUR" } },
        listingPolicies: {
          paymentPolicyId: product.paymentPolicyId,
          returnPolicyId: product.returnPolicyId,
          fulfillmentPolicyId: product.fulfillmentPolicyId,
        },
        merchantLocationKey: product.merchantLocationKey,
      }),
    });

    const offerData = await offerResp.json();

    // Publish
    const pubResp = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerData.offerId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const pubData = await pubResp.json();

    res.json({ ok: true, offerId: offerData.offerId, publish: pubData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
