import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AnalyticsProvider } from "./components/AnalyticsProvider";
import { AuthProvider } from "./components/AuthProvider";
import { PushNotificationProvider } from "./components/PushNotificationProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "App",
  description: "Full stack application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <AnalyticsProvider>
          <AuthProvider>
            <PushNotificationProvider>{children}</PushNotificationProvider>
          </AuthProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
