/**
 * Temporary bridge component that uses the original index.tsx
 * This will be replaced as we extract components into separate files
 */
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from "react-router-dom";
import LightCatalogDemo from "./index";

// This is a temporary wrapper that makes the old component work with routing
const RoutedApp: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  
  // Pass routing functions to the original component via a global or context
  // For now, we'll modify the original component to use routing
  // This is a temporary solution until we extract all components
  
  return <LightCatalogDemo />;
};

export const AppWithRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<RoutedApp />} />
      </Routes>
    </BrowserRouter>
  );
};
