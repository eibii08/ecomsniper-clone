import React, { useState, useEffect } from "react";

export default function ProductForm({ productData, onSubmit }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (productData) {
      setTitle(productData.title || "");
      setPrice(productData.price || "");
    }
  }, [productData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ title, price, quantity });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Produktname"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="number"
        placeholder="Preis (EUR)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="number"
        placeholder="Menge"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        Zu eBay listen
      </button>
    </form>
  );
}
