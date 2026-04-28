import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[#8F95A3] font-mono text-xs uppercase tracking-widest">
        Authenticating...
      </div>
    );
  if (user === false) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
