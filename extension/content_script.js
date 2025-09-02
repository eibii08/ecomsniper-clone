// content_script.js
(function () {
  function getText(selectors) {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) {
        return el.textContent.trim();
      }
    }
    return "";
  }

  const title = getText(["#productTitle", "#title", ".product-title-word-break"]) || document.title;
  let priceRaw = getText(["#priceblock_ourprice", "#priceblock_dealprice", ".a-price .a-offscreen"]);
  if (!priceRaw) {
    const priceEl = document.querySelector(".priceBlockBuyingPriceString, .offer-price");
    if (priceEl) priceRaw = priceEl.textContent;
  }
  let price = priceRaw ? priceRaw.replace(/[^\d,.\-]/g, "").replace(",", ".") : null;
  const asinInput = document.querySelector("#ASIN") || document.querySelector('input[name="ASIN"]');
  const asin = asinInput ? asinInput.value || asinInput.getAttribute("value") : null;

  const images = [];
  const main = document.querySelector("#imgTagWrapperId img") || document.querySelector("#landingImage");
  if (main) {
    images.push(main.src || main.getAttribute("data-old-hires"));
  }
  document.querySelectorAll("#altImages img, .imageThumbnail img, .a-dynamic-image").forEach((img) => {
    if (img.src) images.push(img.src);
  });

  const description =
    getText(["#productDescription", "#bookDescription_feature_div", "#productOverview_feature_div"]) ||
    getText(["#feature-bullets", ".feature-bullets"]);

  const product = {
    title,
    price,
    asin,
    images: Array.from(new Set(images)).filter(Boolean),
    description,
    url: location.href,
  };

  // keep a quick reference
  window.__ECOM_SNIPER_PRODUCT = product;

  // answer to popup requests
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "GET_PRODUCT") {
      sendResponse({ ok: true, product });
    }
  });
})();
