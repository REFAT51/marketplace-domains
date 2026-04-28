import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function fmtErr(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function fmtPrice(usd, currency = "USD", rates = null) {
  const symbols = { USD: "$", EUR: "€", EGP: "EGP ", USDT: "USDT ", BTC: "₿" };
  if (!rates || currency === "USD") return `$${Number(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const rate = rates[currency] || 1;
  const value = Number(usd) * rate;
  if (currency === "BTC") return `₿${value.toFixed(6)}`;
  if (currency === "EGP") return `EGP ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (currency === "USDT") return `${value.toFixed(2)} USDT`;
  if (currency === "EUR") return `€${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${symbols[currency] || ""}${value.toFixed(2)}`;
}
