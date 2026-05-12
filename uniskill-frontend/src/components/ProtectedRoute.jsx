import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasActiveSession } from "../utils/session";

export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!hasActiveSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
