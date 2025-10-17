import type { Metadata } from "next";
import ChunkReloadGuard from "@/app/ChunkReloadGuard";
import { Baloo_Da_2, Poppins, Quintessential, Luckiest_Guy } from "next/font/google";
import "./globals.css";
import "@/app/info/info.css";
import "@/app/api/stats/init";
import Script from "next/script";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // Adjust weights as needed
});

const baloo = Baloo_Da_2({
  variable: "--font-baloo",
  weight: ["700"],
  subsets: ["latin"],
});

const quintessential = Quintessential({
  variable: "--font-quintessential",
  subsets: ["latin"],
  weight: "400",
});

const luckiest = Luckiest_Guy({
  variable: "--font-luckiest",
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
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/mfm5adk.css" />
      </head>
      <body className={`${poppins.variable} ${baloo.variable} ${quintessential.variable} ${luckiest.variable}`}>
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
