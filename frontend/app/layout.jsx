import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { UserProvider } from "@auth0/nextjs-auth0/client";

export const metadata = {
  title: "Compass AI",
  description: "Visual Financial Sandbox for Canadian Small Business Owners",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--cream)' }}>
        <UserProvider>
          <LayoutShell>{children}</LayoutShell>
        </UserProvider>
      </body>
    </html>
  );
}
