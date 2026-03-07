import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Sparkle — The Uber of Cleaning Services",
  description:
    "Find trusted, independent cleaners in your area. Book in minutes, pay securely, and enjoy a sparkling clean home.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sparkle",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/icon-192x192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body className="flex min-h-screen flex-col">
        <ServiceWorkerRegistration />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <InstallPrompt />
      </body>
    </html>
  );
}
