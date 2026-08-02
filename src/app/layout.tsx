import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { InclineProvider } from "@/lib/store";
import { DemoAuthProvider } from "@/lib/demo-auth";
import { StudyMemoryProvider } from "@/lib/study-memory/client";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Incline - Grow Through Focus",
  description:
    "A companion that only grows on verified, undistracted study time, tied to your real class schedule.",
  applicationName: "Incline - Grow Through Focus",
  appleWebApp: {
    capable: true,
    title: "Incline - Grow Through Focus",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <DemoAuthProvider><InclineProvider><StudyMemoryProvider>{children}</StudyMemoryProvider></InclineProvider></DemoAuthProvider>
      </body>
    </html>
  );
}
