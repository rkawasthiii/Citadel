import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/stack";
import { SWRProvider } from "@/lib/context/SWRProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Feeds | Discover Research Papers Your Way",
    template: "%s | Feeds",
  },
  description: "Feeds is an AI-powered research discovery platform that helps academics, students, and researchers discover the latest papers across 23+ scientific fields. Personalized feeds, real-time updates, and an Instagram-like experience for scholarly content.",
  keywords: [
    "research papers",
    "academic discovery",
    "scientific papers",
    "research feed",
    "academic social network",
    "paper recommendations",
    "AI research",
    "scholarly articles",
    "computer science papers",
    "medical research",
    "scientific discovery",
    "PhD research",
    "academic papers",
    "research platform",
  ],
  authors: [{ name: "Feeds Team" }],
  creator: "Feeds",
  publisher: "Feeds",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://veritushackathon.vercel.app",
    siteName: "Feeds",
    title: "Feeds | Discover Research Papers Your Way",
    description: "An AI-powered research discovery platform. Browse 23+ scientific fields, get personalized paper recommendations, and stay updated with the latest academic research in an Instagram-like feed experience.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Feeds - Research Paper Discovery Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Feeds | Discover Research Papers Your Way",
    description: "AI-powered research discovery across 23+ scientific fields. Personalized feeds for academics, students, and researchers.",
    images: ["/og-image.svg"],
    creator: "@feeds",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", type: "image/svg+xml" },
    ],
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://veritushackathon.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.cdnfonts.com/css/billabong" rel="stylesheet" />
      </head>
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <SWRProvider>
          {/* @ts-expect-error Stack Auth type mismatch */}
          <StackProvider app={stackServerApp}>
            <StackTheme>
              {children}
            </StackTheme>
          </StackProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
