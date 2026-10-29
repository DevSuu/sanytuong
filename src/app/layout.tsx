import type { Metadata } from "next";
import { Roboto, Montserrat } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const roboto = Roboto({
  subsets: ["vietnamese", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thử thách sáng tạo 4.0 | UTT",
  description:
    "Thử thách sáng tạo 4.0 — Khơi nguồn ý tưởng. Bứt phá tương lai. Cuộc thi dành cho sinh viên Trường Đại học Công nghệ Giao thông vận tải.",
  icons: {
    icon: [
      { url: "/utt-icon.png?v=3", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico?v=3", sizes: "any" },
    ],
    shortcut: "/utt-icon.png?v=3",
    apple: "/utt-icon.png?v=3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${roboto.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
