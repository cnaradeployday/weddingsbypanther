import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Instrument_Sans,
  Playfair_Display,
  Work_Sans,
  Libre_Baskerville,
  Karla,
  Marcellus,
  Jost,
  Fraunces,
  Manrope,
  Great_Vibes,
  Montserrat,
  EB_Garamond,
  Parisienne,
} from "next/font/google";
import { PwaInstall } from "@/components/PwaInstall";
import { DEPLOYMENT_BUSINESS_TYPE } from "@/lib/businessType";
import "./globals.css";

// Every planner-selectable font pairing (see src/lib/fontChoices.ts) is
// preloaded here as its own CSS variable — next/font/google needs a static
// import per family, so it can't be picked dynamically at runtime per
// planner. globals.css points the site-wide --font-serif/--font-sans at the
// "cormorant" pair by default; a storefront overrides those two variables
// to one of the other pairs based on the planner's font_choice.
const cormorantSerif = Cormorant_Garamond({
  variable: "--font-serif-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
const instrumentSans = Instrument_Sans({
  variable: "--font-sans-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const playfairSerif = Playfair_Display({
  variable: "--font-serif-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});
const workSans = Work_Sans({
  variable: "--font-sans-worksans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const baskervilleSerif = Libre_Baskerville({
  variable: "--font-serif-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});
const karlaSans = Karla({
  variable: "--font-sans-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const marcellusSerif = Marcellus({
  variable: "--font-serif-marcellus",
  subsets: ["latin"],
  weight: ["400"],
});
const jostSans = Jost({
  variable: "--font-sans-jost",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const frauncesSerif = Fraunces({
  variable: "--font-serif-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
const manropeSans = Manrope({
  variable: "--font-sans-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Personalization text fonts (src/lib/textFonts.ts) — a separate, smaller
// picker for the names/date on the product itself, not the storefront.
// Cormorant and Playfair above are reused for two of these six; these four
// are loaded only for this picker.
const greatVibesScript = Great_Vibes({
  variable: "--font-text-greatvibes",
  subsets: ["latin"],
  weight: ["400"],
});
const montserratSans = Montserrat({
  variable: "--font-text-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const ebGaramondSerif = EB_Garamond({
  variable: "--font-text-ebgaramond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
const parisienneScript = Parisienne({
  variable: "--font-text-parisienne",
  subsets: ["latin"],
  weight: ["400"],
});

const fontVariables = [
  cormorantSerif,
  instrumentSans,
  playfairSerif,
  workSans,
  baskervilleSerif,
  karlaSans,
  marcellusSerif,
  jostSans,
  frauncesSerif,
  manropeSans,
  greatVibesScript,
  montserratSans,
  ebGaramondSerif,
  parisienneScript,
]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Bespoke — Wedding merchandise, made personal.",
  description:
    "Design custom favors and centerpieces for your own day, or build a wedding business selling them to your clients.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bespoke",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2A2622",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-business={DEPLOYMENT_BUSINESS_TYPE}>
      <body className={`${fontVariables} antialiased`}>
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
