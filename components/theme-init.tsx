'use client'

import { useEffect } from 'react'

export function ThemeInit() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(savedTheme)
    }
  }, [])

  return null
}
