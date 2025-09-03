import React from "react";

export default function StatusToast({ message, type }) {
  const bgColor =
    type === "success" ? "bg-green-500" : type === "error" ? "bg-red-500" : "bg-yellow-500";
  return (
    <div className={`${bgColor} text-white p-2 rounded mt-4`}>
      {message}
    </div>
  );
}
