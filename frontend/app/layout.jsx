import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Compass AI",
  description: "Visual Financial Sandbox for Canadian Small Business Owners",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
