import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist has no Thai glyphs; the browser falls through to this for Thai text.
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FloodNow",
  description: "Community flood and road-condition reports — see what's passable right now.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Lets the layout extend under the iPhone notch/home indicator; components
  // pad themselves with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plexThai.variable} h-full antialiased`}
    >
      <body className="h-full overscroll-none bg-background">
        <LocaleProvider>
          {children}
          <Toaster position="top-center" offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }} />
        </LocaleProvider>
      </body>
    </html>
  );
}
