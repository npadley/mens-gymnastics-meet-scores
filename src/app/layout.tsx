import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "US Men's Gymnastics Scores",
    template: "%s | US Men's Gymnastics Scores",
  },
  description:
    "Search and browse meet scores for United States men's artistic gymnastics — from Level 6 through Elite and NCAA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
      >
        <Nav />
        <main>{children}</main>
        <footer className="mt-16 border-t border-gray-200 py-8 text-center text-sm text-gray-400">
          US Men&apos;s Gymnastics Scores — data sourced from USA Gymnastics, NCAA, and The Gymternet.
          Not affiliated with USA Gymnastics or the NCAA.
        </footer>
      </body>
    </html>
  );
}
