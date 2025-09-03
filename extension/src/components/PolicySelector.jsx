import React from "react";

export default function PolicySelector() {
  return (
    <div className="mt-4 space-y-2">
      <label className="block font-semibold">Wähle Policies:</label>
      <select className="w-full p-2 border rounded">
        <option>Payment Policy 1</option>
        <option>Payment Policy 2</option>
      </select>
      <select className="w-full p-2 border rounded">
        <option>Return Policy 1</option>
        <option>Return Policy 2</option>
      </select>
      <select className="w-full p-2 border rounded">
        <option>Shipping Policy 1</option>
        <option>Shipping Policy 2</option>
      </select>
    </div>
  );
}
