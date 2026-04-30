import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// For now, we'll import a bridge component that uses the original index.tsx
// Components will be extracted gradually
import LightCatalogDemo from "../index";

// Temporary: Route all paths to the original component
// This will be replaced as we extract components
export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<LightCatalogDemo />} />
      </Routes>
    </BrowserRouter>
  );
};
