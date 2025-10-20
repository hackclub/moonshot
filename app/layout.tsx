import type { Metadata } from "next";
import ChunkReloadGuard from "@/app/ChunkReloadGuard";
import { Kavoon } from "next/font/google";
import "./globals.css";
import "@/app/api/stats/init";
import Script from "next/script";

const kavoon = Kavoon({
  variable: "--font-kavoon",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Moonshot",
  description:
    "A 4-day hackathon in Florida visiting Kennedy Space Center and Universal Studios.",
  openGraph: {
    title: "Moonshot",
    description:
      "A 4-day hackathon in Florida visiting Kennedy Space Center and Universal Studios.",
    siteName: "Moonshot",
    images: [
      {
        url: 'https://moonshot.hackclub.com/launchImgSmaller.webp', 
        alt: 'Moonshot Hackathon dates and location', 
      },
    ],
  },
  twitter: {
    card: "summary_large_image", // Use summary_large_image for image previews
    title: "Moonshot",
    description:
      "A 4-day hackathon in Florida visiting Kennedy Space Center and Universal Studios.",
    images: ['https://moonshot.hackclub.com/launchImgSmaller.webp'], // Path to your image
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    shortcut: ['/favicon.png'],
    apple: ['/favicon.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="theme-reskin">
      <head></head>
      <body className={`${kavoon.variable}`}>
        <ChunkReloadGuard />
        {children}
        <div id="root-portal"></div>
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src="https://plausible.io/js/pa-nzb6Zze2AAGidzdDAKnXb.js"
              strategy="afterInteractive"
            />
            <Script id="plausible-init" strategy="afterInteractive">
              {`
                window.plausible = window.plausible || function(){ (plausible.q = plausible.q || []).push(arguments) };
                plausible.init = plausible.init || function(i){ plausible.o = i || {} };
                plausible.init();
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
