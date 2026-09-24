import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Twolbox - Quote Maker",
  description: "Build a quote by product code. Prices inclusive of GST, confirmed at the delivery counter.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions inject attributes into <html>/<body> before React loads (e.g. inmaintabuse="1"),
    // which triggers a harmless hydration mismatch. This only silences attribute diffs on these two tags.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
