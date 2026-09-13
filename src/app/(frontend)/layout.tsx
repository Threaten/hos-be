import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Manage House of Senses branches and content.',
  title: 'House of Senses Admin',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
