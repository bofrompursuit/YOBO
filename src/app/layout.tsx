import type { Metadata } from "next";
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
