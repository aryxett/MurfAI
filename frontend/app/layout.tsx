import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';
import '@/app/globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
});

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata = {
  title: 'RAKSHIKA | Disaster Response',
  description: 'Disaster response voice AI for immediate assistance and rescue coordination.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="font-body bg-[var(--navy-950)] text-[var(--off-white)] antialiased selection:bg-[var(--amber)] selection:text-[var(--navy-950)]">
        {children}
      </body>
    </html>
  );
}
