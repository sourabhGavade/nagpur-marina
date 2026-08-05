import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "../components/pwa-register";
import { Toaster } from "../components/ui/sonner";
import { TabletContextProvider } from "../contexts/tablet-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nagpur Marina",
  description: "Nagpur Marina tablet experience",
  applicationName: "Nagpur Marina",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nagpur Marina",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#171815",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full">
        <TabletContextProvider>{children}</TabletContextProvider>
        <Toaster position="top-center" />
        <PwaRegister />
      </body>
    </html>
  );
}
