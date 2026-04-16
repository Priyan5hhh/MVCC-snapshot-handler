import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import HistoryPage from "./HistoryPage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"                     element={<App />} />
        <Route path="/history/:todoId"       element={<HistoryPage />} />
        {/* Catch-all → back to home */}
        <Route path="*"                     element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);