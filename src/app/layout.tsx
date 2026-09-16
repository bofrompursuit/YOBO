import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Sans, Orbitron } from "next/font/google";
import { MotionConfig } from "framer-motion";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const orbitron = Orbitron({
  variable: "--font-hud",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "YOBO — Some nights are worth holding onto",
  description:
    "An immersive night out with four rooms and four different moods — neon hallways, a mural-lit bar, a hidden garden, and a table where the cards get read.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${orbitron.variable} antialiased`}
    >
      <body>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
