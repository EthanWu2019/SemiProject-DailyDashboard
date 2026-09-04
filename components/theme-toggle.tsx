'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-react'

declare global {
  interface Document {
    startViewTransition?: (callback: () => void) => {
      ready: Promise<void>
      finished: Promise<void>
    }
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)
  const isAnimatingRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'dark' : 'light')
    }
  }, [])

  const toggleTheme = useCallback(
    async (e: React.MouseEvent) => {
      if (isAnimatingRef.current) return

      const x = e.clientX
      const y = e.clientY
      const w = window.innerWidth
      const h = window.innerHeight

      const maxRadius = Math.ceil(
        Math.sqrt(Math.max(x, w - x) ** 2 + Math.max(y, h - y) ** 2)
      )

      const newTheme = theme === 'dark' ? 'light' : 'dark'

      const applyTheme = () => {
        document.documentElement.classList.remove('dark', 'light')
        document.documentElement.classList.add(newTheme)
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
      }

      if (document.startViewTransition) {
        isAnimatingRef.current = true

        const transition = document.startViewTransition(applyTheme)

        try {
          await transition.ready
          
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${maxRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 500,
              easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              pseudoElement: '::view-transition-new(root)',
            }
          )
          
          await transition.finished
        } catch {
          // Fallback if animation fails
        } finally {
          isAnimatingRef.current = false
        }
      } else {
        applyTheme()
      }
    },
    [theme]
  )

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled className="h-8 w-8 sm:h-9 sm:w-9">
        <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-8 w-8 sm:h-9 sm:w-9"
      aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
      ) : (
        <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
      )}
    </Button>
  )
}
