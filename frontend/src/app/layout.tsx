// app/layout.tsx
import { AuthProvider } from '@/auth/AuthProvider';
import { SocketProvider } from '@/hooks/useSocket';
import { ReactQueryProvider } from '@/lib/react-query-provider';
import type { Metadata } from 'next';
import './globals.css';
import Providers from './root-client-layout';

export const metadata: Metadata = {
  title: 'Streamlit',
  description: 'Your video and chat app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <AuthProvider>
            <SocketProvider>
              <Providers>
                {children}
              </Providers>
            </SocketProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
