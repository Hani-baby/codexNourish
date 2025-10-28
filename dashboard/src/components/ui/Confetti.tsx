import React, { useEffect, useState } from 'react'

interface ConfettiProps {
  show: boolean
  onComplete?: () => void
}

export default function Confetti({ show, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Array<{
    id: number
    x: number
    y: number
    rotation: number
    scale: number
    color: string
    delay: number
  }>>([])

  useEffect(() => {
    if (show) {
      // Generate confetti particles
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        rotation: Math.random() * 360,
        scale: Math.random() * 0.5 + 0.5,
        color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][Math.floor(Math.random() * 7)],
        delay: Math.random() * 0.5
      }))
      setParticles(newParticles)

      // Clean up after animation
      const timer = setTimeout(() => {
        setParticles([])
        onComplete?.()
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!show) return null

  return (
    <div className="confetti-container">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={{
            '--x': `${particle.x}%`,
            '--y': `${particle.y}%`,
            '--rotation': `${particle.rotation}deg`,
            '--scale': particle.scale,
            '--color': particle.color,
            '--delay': `${particle.delay}s`
          } as React.CSSProperties}
        />
      ))}

      <style jsx>{`
        .confetti-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: var(--z-toast);
          overflow: hidden;
        }

        .confetti-particle {
          position: absolute;
          top: var(--y);
          left: var(--x);
          width: 8px;
          height: 8px;
          background-color: var(--color);
          border-radius: 50%;
          transform: rotate(var(--rotation)) scale(var(--scale));
          animation: confettiFall 3s ease-out var(--delay) forwards;
        }

        .confetti-particle:nth-child(odd) {
          width: 6px;
          height: 12px;
          border-radius: 3px;
        }

        .confetti-particle:nth-child(3n) {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(-100vh) rotate(var(--rotation)) scale(var(--scale));
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(calc(var(--rotation) + 720deg)) scale(0.1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
