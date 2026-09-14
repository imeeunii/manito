import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리 반 마니또",
  description: "여러 반이 함께 사용할 수 있는 또래 관계 수업용 마니또",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
