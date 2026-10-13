import type { Metadata, Viewport } from "next";
import { AppToaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
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
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
