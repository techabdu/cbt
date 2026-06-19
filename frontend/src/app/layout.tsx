import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "@/providers";

export const metadata: Metadata = {
  title: "CBT System",
  description:
    "Computer-Based Testing system for a Nigerian College of Education.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning is required by next-themes (it sets the class on
  // <html> before React hydrates).
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
