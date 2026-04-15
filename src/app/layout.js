import { Inter, Rajdhani } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-primary",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Vamaq Motors — Alta Performance e Exclusividade",
    template: "%s | Vamaq Motors",
  },
  description:
    "Boutique automotiva especializada em veículos premium, esportivos e superesportivos. Curadoria rigorosa e procedência garantida.",
  metadataBase: new URL("https://vamaqmotors.com.br"),
  openGraph: {
    title: "Vamaq Motors — Alta Performance e Exclusividade",
    description:
      "Boutique automotiva especializada em veículos premium, esportivos e superesportivos.",
    url: "https://vamaqmotors.com.br",
    siteName: "Vamaq Motors",
    locale: "pt_BR",
    type: "website",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
};

export const viewport = {
  themeColor: "#FF6A00",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${rajdhani.variable}`}>
      <body style={{ fontFamily: "var(--font-primary)" }}>
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
