import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control Center",
  description: "A self-hosted dashboard for signals, mentions, newsletters, audience, reminders, and tasks.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Set by proxy.ts; reading request headers also keeps every page dynamic,
  // which a per-request CSP nonce requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("control-center-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
