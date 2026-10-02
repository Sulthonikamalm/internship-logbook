"use client";
import { Toaster } from "sonner";
export function AppToaster() {
  return <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: "1rem" } }} />;
}
