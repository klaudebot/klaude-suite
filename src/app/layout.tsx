import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProvider } from "@/components/WalletProvider";
import { BackendProvider } from "@/components/BackendProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Klaude Suite - Supercharge Your OpenClaw",
  description: "Add financial guardrails, swarm scaling, and verified skills to OpenClaw. Smart Safe for your AI that actually does things.",
  openGraph: {
    title: "Klaude Suite for OpenClaw",
    description: "Financial guardrails for OpenClaw. Your AI handles your money—make sure it follows the rules.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klaude Suite for OpenClaw",
    description: "Financial guardrails for OpenClaw. Your AI handles your money—make sure it follows the rules.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0f]`}
      >
        <WalletProvider>
          <BackendProvider>{children}</BackendProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
