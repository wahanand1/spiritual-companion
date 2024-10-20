import { Toaster } from 'react-hot-toast'
import { Header } from '@/components/Header'
import ThemesProvider from '@/providers/ThemesProvider'
import '@/styles/globals.scss'
import '@/styles/theme-config.css'

export const metadata = {
  title: {
    default: 'BK-ChatGPT',
    template: `%s - BK-ChatGPT`
  },
  description: 'BKChat powered by ChatGPT',
  icons: {
    icon: '/shiv-baba-logo.ico',
    shortcut: '/shiv-baba-logo.png',
    apple: '/shiv-baba-logo.png'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemesProvider>
          <Header />
          {children}
          <Toaster />
        </ThemesProvider>
      </body>
    </html>
  )
}
