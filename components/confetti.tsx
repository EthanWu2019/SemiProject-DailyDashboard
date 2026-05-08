"use client"

import { useEffect, useState } from "react"

interface ConfettiPiece {
  id: number
  x: number
  delay: number
  duration: number
  color: string
}

export function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    if (active) {
      const colors = [
        "oklch(0.7 0.18 310)", // primary pink-purple
        "oklch(0.75 0.15 340)", // pink
        "oklch(0.65 0.2 280)", // purple
        "oklch(0.8 0.12 60)", // gold
        "oklch(0.7 0.15 200)", // teal
      ]
      
      const newPieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 3 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }))
      setPieces(newPieces)
    } else {
      setPieces([])
    }
  }, [active])

  if (!active || pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-2 h-3 opacity-80"
          style={{
            left: `${piece.x}%`,
            top: "-20px",
            backgroundColor: piece.color,
            animation: `confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
