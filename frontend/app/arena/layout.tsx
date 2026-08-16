import { Poppins, JetBrains_Mono, Inter } from "next/font/google";

const poppins = Poppins({ variable: "--arena-font-display", weight: ["600", "700", "800"], subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--arena-font-mono", weight: ["500", "600"], subsets: ["latin"] });
const inter = Inter({ variable: "--arena-font-body", weight: ["400", "500", "600"], subsets: ["latin"] });

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${poppins.variable} ${jetbrainsMono.variable} ${inter.variable}`}>{children}</div>;
}
