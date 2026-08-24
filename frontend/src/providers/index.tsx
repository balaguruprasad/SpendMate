"use client";

import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth/auth-context";

/** Composed client provider tree wrapping the whole app. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3500,
                style: {
                  background: "var(--card)",
                  color: "var(--card-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.625rem",
                  fontSize: "0.875rem",
                },
                success: {
                  iconTheme: {
                    primary: "var(--success)",
                    secondary: "var(--card)",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "var(--destructive)",
                    secondary: "var(--card)",
                  },
                },
              }}
            />
          </TooltipProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
