import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

// Dark is the default, so this script only ever ADDS .light — for an explicit
// "light" choice, or for a "system" choice on a light OS. Runs before paint.
const themeBoot = `try{var t=localStorage.getItem("theme");var d=document.documentElement;if(t==="light")d.classList.add("light");else if(t!=="dark"&&matchMedia("(prefers-color-scheme:light)").matches)d.classList.add("light")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        <meta name="theme-color" content="#14120E" />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
