import { Geist_Mono, Inter } from "next/font/google"
import Script from "next/script"

import "./globals.css"
import { TenantProvider } from "@/components/tenant-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

/** Runs before paint to avoid theme flash; kept outside ThemeProvider React tree. */
const themeInitScript = `
(function() {
  try {
    var storageKey = 'theme';
    var theme = localStorage.getItem(storageKey);
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = theme === 'dark' || theme === 'light'
      ? theme
      : (systemDark ? 'dark' : 'light');
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body suppressHydrationWarning>
        <Script id="ahms-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>
          <TenantProvider>{children}</TenantProvider>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
