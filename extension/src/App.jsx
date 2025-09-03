import React, { useState, useEffect } from "react";
import ProductForm from "./components/ProductForm";
import PolicySelector from "./components/PolicySelector";
import StatusToast from "./components/StatusToast";
import axios from "axios";

export default function App() {
  const [productData, setProductData] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });

  // Content Script sendet Amazon-Daten hierher
  useEffect(() => {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "AMAZON_PRODUCT") {
        setProductData(msg.payload);
      }
    });
  }, []);

  const handleSubmit = async (listingData) => {
    setStatus({ message: "Listing wird erstellt...", type: "loading" });
    try {
      const res = await axios.post(
        "https://ecomsniper-clone.onrender.com/api/listings/create",
        listingData
      );
      setStatus({ message: "Produkt erfolgreich gelistet!", type: "success" });
    } catch (err) {
      setStatus({ message: "Fehler beim Listen: " + err.message, type: "error" });
    }
  };

  return (
    <div className="p-4 w-[400px]">
      <h1 className="text-2xl font-bold mb-4">EcomSniper — Quick List</h1>
      <ProductForm productData={productData} onSubmit={handleSubmit} />
      <PolicySelector />
      {status.message && <StatusToast {...status} />}
    </div>
  );
}
