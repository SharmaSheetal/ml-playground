import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AIProvider } from "@/context/AIContext";
import { Navbar } from "@/components/layout/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ML Ops Playground",
  description: "Interactive MLOps learning platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AIProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </AIProvider>
      </body>
    </html>
  );
}
