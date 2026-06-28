import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppProvider } from "@/components/providers/app-provider";
import { PlatformSync } from "@/components/providers/platform-sync";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CompetencyFlow — Training for SNF, Behavioral Health & Home Health",
  description:
    "Structured lessons and Ask Policy for SNFs, Behavioral Health, and Home Health. Managers get visibility and tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AppProvider>
          <PlatformSync />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}