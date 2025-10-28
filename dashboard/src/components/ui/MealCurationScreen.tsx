import React, { useState, useEffect } from 'react'
import MealPlanLoadingState from './MealPlanLoadingState'

interface MealCurationScreenProps {
  isVisible: boolean
  onComplete: () => void
  planData?: {
    dateRange: { start: string; end: string }
    inspiration: string
    mealsPerDay: number
    servings: number
  }
}

export default function MealCurationScreen({ isVisible, onComplete, planData }: MealCurationScreenProps) {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('Analyzing preferences...')

  const steps = [
    'Analyzing preferences...',
    'Finding perfect recipes...',
    'Balancing nutrition...',
    'Adjusting portions...',
    'Finalizing schedule...'
  ]

  useEffect(() => {
    if (!isVisible) return

    let stepIndex = 0
    
    // Progress animation
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 1
        
        // Update current step based on progress
        const newStepIndex = Math.min(Math.floor(newProgress / 20), 4)
        if (newStepIndex !== stepIndex) {
          stepIndex = newStepIndex
          setCurrentStep(steps[stepIndex])
        }
        
        if (newProgress >= 100) {
          clearInterval(progressTimer)
          return 100
        }
        return newProgress
      })
    }, 100)

    return () => {
      clearInterval(progressTimer)
    }
  }, [isVisible, steps])

  return (
    <MealPlanLoadingState 
      isVisible={isVisible}
      progress={progress}
      currentStep={currentStep}
      onComplete={onComplete}
    />
  )
}

