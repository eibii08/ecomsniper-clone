// popup.js
const serverBase = "https://ecomsniper-clone.onrender.com"; // <--- passe an falls nötig

document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const productDiv = document.getElementById("product");
  const priceInput = document.getElementById("priceInput");
  const qtyInput = document.getElementById("qtyInput");
  const paymentSelect = document.getElementById("paymentSelect");
  const returnSelect = document.getElementById("returnSelect");
  const fulfillmentSelect = document.getElementById("fulfillmentSelect");
  const locationSelect = document.getElementById("locationSelect");
  const resultDiv = document.getElementById("result");
  const listBtn = document.getElementById("listBtn");
  const authBtn = document.getElementById("authBtn");

  // get product from active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  chrome.tabs.sendMessage(tab.id, { type: "GET_PRODUCT" }, (resp) => {
    if (resp && resp.product) {
      status.textContent = "Produkt gefunden";
      const p = resp.product;
      productDiv.innerHTML = `<strong>${escapeHtml(p.title)}</strong><div class="muted">ASIN: ${escapeHtml(p.asin || "-")}</div><div style="margin-top:6px">${p.images && p.images[0] ? `<img src="${p.images[0]}" style="max-width:100%;border-radius:6px"/>` : ""}</div>`;
      priceInput.value = p.price || "";
    } else {
      status.textContent = "Kein Produkt auf dieser Seite gefunden.";
    }
  });

  // fetch policies and locations
  async function loadPolicies() {
    try {
      const r = await fetch(`${serverBase}/api/ebay/policies`);
      if (!r.ok) throw new Error("policies fetch failed");
      const data = await r.json();

      paymentSelect.innerHTML = `<option value="">-- Zahlungs-Policy (optional) --</option>`;
      (data.payment && data.payment.paymentPolicies || []).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.paymentPolicyId;
        opt.textContent = p.name || `${p.paymentPolicyId}`;
        paymentSelect.appendChild(opt);
      });

      fulfillmentSelect.innerHTML = `<option value="">-- Fulfillment (Versand) --</option>`;
      (data.fulfillment && data.fulfillment.fulfillmentPolicies || []).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.fulfillmentPolicyId;
        opt.textContent = p.name || p.fulfillmentPolicyId;
        fulfillmentSelect.appendChild(opt);
      });

      returnSelect.innerHTML = `<option value="">-- Return (Rückgabe) --</option>`;
      (data.returns && data.returns.returnPolicies || []).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.returnPolicyId;
        opt.textContent = p.name || p.returnPolicyId;
        returnSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("loadPolicies err", err);
    }
  }

  async function loadLocations() {
    try {
      const r = await fetch(`${serverBase}/api/ebay/locations`);
      const data = await r.json();
      locationSelect.innerHTML = `<option value="">-- Merchant Location (für Publish) --</option>`;
      (data.locations || []).forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc.merchantLocationKey;
        opt.textContent = `${loc.name || loc.merchantLocationKey} (${loc.merchantLocationStatus || ""})`;
        locationSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("loadLocations err", err);
    }
  }

  await loadPolicies();
  await loadLocations();

  authBtn.addEventListener("click", async () => {
    // open /auth in new tab via background
    const authUrl = `${serverBase}/auth`;
    chrome.runtime.sendMessage({ type: "OPEN_AUTH", url: authUrl });
  });

  listBtn.addEventListener("click", async () => {
    resultDiv.textContent = "Listing läuft...";
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      chrome.tabs.sendMessage(tab.id, { type: "GET_PRODUCT" }, async (resp) => {
        const product = (resp && resp.product) || {};
        const payload = {
          sku: `SNIP-${Date.now()}`,
          title: product.title || "No title",
          description: product.description || product.title,
          price: priceInput.value,
          currency: "EUR",
          quantity: Number(qtyInput.value || 1),
          images: product.images || [],
          categoryId: null, // you can add here a category ID if you have it
          merchantLocationKey: locationSelect.value || undefined,
          paymentPolicyId: paymentSelect.value || undefined,
          returnPolicyId: returnSelect.value || undefined,
          fulfillmentPolicyId: fulfillmentSelect.value || undefined,
        };

        const r = await fetch(`${serverBase}/api/listings/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await r.json();
        resultDiv.textContent = JSON.stringify(json, null, 2);
      });
    } catch (err) {
      resultDiv.textContent = "Fehler: " + err.message;
    }
  });

  function escapeHtml(s) { return (s||"").replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }
});
