import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, fmtErr } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);  // null = loading; false = logged out
  const [currency, setCurrency] = useState("USD");
  const [rates, setRates] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    api.get("/currency/rates").then(({ data }) => setRates(data.rates)).catch(() => {});
    const saved = localStorage.getItem("currency");
    if (saved) setCurrency(saved);
  }, [refresh]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: fmtErr(e.response?.data?.detail) };
    }
  };

  const register = async (email, password, name, role) => {
    try {
      const { data } = await api.post("/auth/register", { email, password, name, role });
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: fmtErr(e.response?.data?.detail) };
    }
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  const changeCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("currency", c);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, login, register, logout, refresh, currency, changeCurrency, rates }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
