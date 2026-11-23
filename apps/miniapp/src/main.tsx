import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { ConfirmHost } from "./components/ConfirmHost";
import { ToastProvider } from "./components/Toast";
import "./index.css";
import { errorCode } from "./lib/api-error";
import { initTelegram } from "./lib/telegram";

initTelegram("#f1f2f4");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Kirmagan (401) — qayta urinish befoyda: sayt darhol kirish sahifasini ko'rsatadi.
      retry: (count, error) => count < 1 && errorCode(error) !== "UNAUTHORIZED",
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
        <ConfirmHost />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
