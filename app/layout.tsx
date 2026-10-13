import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const a2g = localFont({
  src: [
    { path: "./fonts/a2g-extralight.ttf", weight: "200", style: "normal" },
    { path: "./fonts/a2g-medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/a2g-bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/a2g-black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-a2g",
  display: "swap",
});

export const metadata: Metadata = {
  title: "우리 반 마니또",
  description: "여러 반이 함께 사용할 수 있는 또래 관계 수업용 마니또",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf7ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={a2g.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
