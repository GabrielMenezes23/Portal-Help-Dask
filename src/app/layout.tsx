import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import './brand.css';

export const metadata: Metadata = {
  title: {
    default: 'CAF TI Helpdesk',
    template: '%s | CAF TI Helpdesk',
  },
  description: 'Portal oficial de chamados e atendimento da CAF TI.',
  icons: {
    icon: '/branding/ti-symbol.svg',
    shortcut: '/branding/ti-symbol.svg',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
