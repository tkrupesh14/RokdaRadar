import type { Metadata } from "next";
import { Caprasimo, Figtree } from "next/font/google";
import "./globals.css";

const caprasimo = Caprasimo({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-body",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RokdaRadar — proof of where relief money goes",
  description:
    "RokdaRadar is a transparency layer for disaster relief. Donations move via UPI; every rupee spent is recorded with evidence on Monad.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${caprasimo.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
