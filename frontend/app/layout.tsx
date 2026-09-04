import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import CursorFollower from "@/components/ui/cursor-follower";
import "./globals.css";

// Space Grotesk for display: technical, slightly squared terminals that read
// as engineered rather than decorative -- the point of the redesign.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Money, percentages and 0x hashes render in mono with tabular figures, so
// verifiable data is visually distinct from prose and columns don't shift.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RokdaRadar — proof of where relief money goes",
  description:
    "RokdaRadar is a transparency layer for disaster relief. Donations move via UPI; every rupee spent is recorded with evidence on Monad.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable}`}
    >
      <body>
        {children}
        {/* Self-disables on touch devices and under prefers-reduced-motion. */}
        <CursorFollower />
      </body>
    </html>
  );
}
