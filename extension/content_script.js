// Läuft automatisch auf Amazon-Produktseiten
(function () {
  const sendProductData = () => {
    try {
      const title = document.querySelector("#productTitle")?.innerText.trim() || "";
      const price = document.querySelector(
        ".a-price .a-offscreen"
      )?.innerText.replace("€", "").trim() || "";
      const images = Array.from(document.querySelectorAll("#altImages img")).map(img =>
        img.src.replace(/\.(_.*_)\./, ".")
      );
      const asin = document.querySelector("#ASIN")?.value || "";
      const quantityAvailable = parseInt(
        document.querySelector("#availability .a-declarative span")?.innerText.match(/\d+/)?.[0] || "0"
      );

      const productData = {
        title,
        price,
        images,
        asin,
        quantityAvailable,
        url: window.location.href,
      };

      // Sende die Daten an das Popup
      chrome.runtime.sendMessage({ type: "AMAZON_PRODUCT", payload: productData });
    } catch (err) {
      console.error("Fehler beim Auslesen des Amazon-Produkts:", err);
    }
  };

  // Warte, bis die Seite geladen ist
  window.addEventListener("load", () => {
    setTimeout(sendProductData, 1000); // kleine Verzögerung für alle Elemente
  });
})();
