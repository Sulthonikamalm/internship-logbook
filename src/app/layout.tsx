import type { Metadata, Viewport } from "next";
import { AppToaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "InternFlow — Internship Activity & Evidence Logbook System",
  description:
    "Responsive internship logbook system with central evidence storage, quick activity recording, and verified reports.",
  applicationName: "InternFlow",
  authors: [{ name: "InternFlow Engineering" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563EB",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
