/**
 * Home Page Component
 * TODO: Extract from index.tsx Home component (around line 1478)
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { translations } from "../constants/translations";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const app = useApp();
  const t = (key: string) => translations[app.lang]?.[key] ?? translations.EN[key] ?? key;

  // Temporary: This will be replaced with the actual Home component from index.tsx
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Home Page</h1>
          <p className="text-slate-600">This component needs to be extracted from index.tsx</p>
          <p className="text-sm text-slate-500 mt-4">
            The Home component is defined around line 1478 in index.tsx
          </p>
        </div>
      </div>
    </div>
  );
};
