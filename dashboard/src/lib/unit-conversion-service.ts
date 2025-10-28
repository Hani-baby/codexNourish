import { supabase } from './supabase'

export interface Unit {
  id: string
  code: string
  display_name: string
  is_mass: boolean
  to_gram_factor?: number
  to_milliliter_factor?: number
}

export interface ConversionResult {
  normalized_g?: number
  normalized_ml?: number
  display_quantity: number
  display_unit: string
  can_combine: boolean
}

// Cache for units to avoid repeated database calls
let unitsCache: Unit[] | null = null

// Get all units from database
export async function getUnits(): Promise<Unit[]> {
  if (unitsCache) return unitsCache

  const { data, error } = await supabase
    .from('units')
    .select('*')
    .order('display_name')

  if (error) throw error
  unitsCache = data || []
  return unitsCache
}

// Find unit by code
export async function findUnitByCode(code: string): Promise<Unit | null> {
  const units = await getUnits()
  return units.find(unit => unit.code.toLowerCase() === code.toLowerCase()) || null
}

// Convert quantity to normalized grams/milliliters
export async function normalizeQuantity(
  quantity: number, 
  unitCode: string
): Promise<ConversionResult> {
  const unit = await findUnitByCode(unitCode)
  
  if (!unit) {
    // Handle unknown units - assume they can't be combined
    return {
      display_quantity: quantity,
      display_unit: unitCode,
      can_combine: false
    }
  }

  const result: ConversionResult = {
    display_quantity: quantity,
    display_unit: unit.display_name,
    can_combine: true
  }

  if (unit.is_mass && unit.to_gram_factor) {
    result.normalized_g = quantity * unit.to_gram_factor
  } else if (!unit.is_mass && unit.to_milliliter_factor) {
    result.normalized_ml = quantity * unit.to_milliliter_factor
  } else {
    // Unit exists but no conversion factor - can't normalize
    result.can_combine = false
  }

  return result
}

// Convert normalized quantity back to preferred unit
export async function denormalizeQuantity(
  normalizedG?: number,
  normalizedMl?: number,
  preferredUnitCode?: string
): Promise<{ quantity: number; unit: string }> {
  const units = await getUnits()
  
  if (normalizedG && preferredUnitCode) {
    const unit = await findUnitByCode(preferredUnitCode)
    if (unit && unit.is_mass && unit.to_gram_factor) {
      return {
        quantity: normalizedG / unit.to_gram_factor,
        unit: unit.display_name
      }
    }
  }
  
  if (normalizedMl && preferredUnitCode) {
    const unit = await findUnitByCode(preferredUnitCode)
    if (unit && !unit.is_mass && unit.to_milliliter_factor) {
      return {
        quantity: normalizedMl / unit.to_milliliter_factor,
        unit: unit.display_name
      }
    }
  }

  // Default to most appropriate unit
  if (normalizedG) {
    // Find best mass unit
    if (normalizedG >= 1000) {
      return { quantity: normalizedG / 1000, unit: 'kg' }
    } else {
      return { quantity: normalizedG, unit: 'g' }
    }
  }
  
  if (normalizedMl) {
    // Find best volume unit
    if (normalizedMl >= 1000) {
      return { quantity: normalizedMl / 1000, unit: 'L' }
    } else {
      return { quantity: normalizedMl, unit: 'ml' }
    }
  }

  return { quantity: 0, unit: 'unit' }
}

// Check if two ingredients can be combined (same type - mass or volume)
export function canCombineIngredients(
  ingredient1: { normalized_g?: number; normalized_ml?: number },
  ingredient2: { normalized_g?: number; normalized_ml?: number }
): boolean {
  // Both have mass measurements
  if (ingredient1.normalized_g && ingredient2.normalized_g) {
    return true
  }
  
  // Both have volume measurements
  if (ingredient1.normalized_ml && ingredient2.normalized_ml) {
    return true
  }
  
  // Can't combine different types or unnormalized quantities
  return false
}

// Combine two normalized quantities
export function combineNormalizedQuantities(
  quantities: Array<{ normalized_g?: number; normalized_ml?: number }>
): { normalized_g?: number; normalized_ml?: number } {
  const totalG = quantities.reduce((sum, q) => sum + (q.normalized_g || 0), 0)
  const totalMl = quantities.reduce((sum, q) => sum + (q.normalized_ml || 0), 0)
  
  return {
    normalized_g: totalG > 0 ? totalG : undefined,
    normalized_ml: totalMl > 0 ? totalMl : undefined
  }
}

// Smart unit selection for display (chooses most readable unit)
export async function selectBestDisplayUnit(
  normalizedG?: number,
  normalizedMl?: number
): Promise<{ quantity: number; unit: string }> {
  if (normalizedG) {
    if (normalizedG >= 1000) {
      return { quantity: Math.round((normalizedG / 1000) * 100) / 100, unit: 'kg' }
    } else if (normalizedG >= 1) {
      return { quantity: Math.round(normalizedG * 100) / 100, unit: 'g' }
    } else {
      return { quantity: Math.round(normalizedG * 1000 * 100) / 100, unit: 'mg' }
    }
  }
  
  if (normalizedMl) {
    if (normalizedMl >= 1000) {
      return { quantity: Math.round((normalizedMl / 1000) * 100) / 100, unit: 'L' }
    } else if (normalizedMl >= 5) {
      return { quantity: Math.round(normalizedMl * 100) / 100, unit: 'ml' }
    } else {
      return { quantity: Math.round(normalizedMl * 1000 * 100) / 100, unit: 'μl' }
    }
  }
  
  return { quantity: 1, unit: 'unit' }
}

// Parse quantity strings like "2 1/2 cups" or "1.5kg"
export function parseQuantityString(quantityStr: string): { quantity: number; unit: string } {
  const cleanStr = quantityStr.trim().toLowerCase()
  
  // Handle fractions like "2 1/2" or "1/2"
  const fractionMatch = cleanStr.match(/^(\d+)?\s*(\d+)\/(\d+)\s*(.*)$/)
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1] || '0')
    const numerator = parseInt(fractionMatch[2])
    const denominator = parseInt(fractionMatch[3])
    const unit = fractionMatch[4].trim()
    const quantity = whole + (numerator / denominator)
    return { quantity, unit: unit || 'unit' }
  }
  
  // Handle decimal numbers
  const decimalMatch = cleanStr.match(/^(\d*\.?\d+)\s*(.*)$/)
  if (decimalMatch) {
    const quantity = parseFloat(decimalMatch[1])
    const unit = decimalMatch[2].trim()
    return { quantity, unit: unit || 'unit' }
  }
  
  // Fallback
  return { quantity: 1, unit: cleanStr || 'unit' }
}

// Format quantity for display with appropriate precision
export function formatQuantityForDisplay(quantity: number, unit: string): string {
  // Round to appropriate precision based on size
  let rounded: number
  if (quantity >= 100) {
    rounded = Math.round(quantity)
  } else if (quantity >= 10) {
    rounded = Math.round(quantity * 10) / 10
  } else if (quantity >= 1) {
    rounded = Math.round(quantity * 100) / 100
  } else {
    rounded = Math.round(quantity * 1000) / 1000
  }
  
  // Handle fractions for common cooking amounts
  if (unit.includes('cup') || unit.includes('tsp') || unit.includes('tbsp')) {
    return formatAsFraction(rounded, unit)
  }
  
  return `${rounded} ${unit}`
}

// Convert decimal to fraction for cooking measurements
function formatAsFraction(decimal: number, unit: string): string {
  const whole = Math.floor(decimal)
  const fraction = decimal - whole
  
  // Common cooking fractions
  const fractions = [
    { decimal: 0.125, display: '1/8' },
    { decimal: 0.25, display: '1/4' },
    { decimal: 0.333, display: '1/3' },
    { decimal: 0.375, display: '3/8' },
    { decimal: 0.5, display: '1/2' },
    { decimal: 0.625, display: '5/8' },
    { decimal: 0.667, display: '2/3' },
    { decimal: 0.75, display: '3/4' },
    { decimal: 0.875, display: '7/8' }
  ]
  
  // Find closest fraction
  const closest = fractions.reduce((prev, curr) => 
    Math.abs(curr.decimal - fraction) < Math.abs(prev.decimal - fraction) ? curr : prev
  )
  
  // Use fraction if close enough (within 0.05)
  if (Math.abs(closest.decimal - fraction) < 0.05) {
    if (whole > 0) {
      return `${whole} ${closest.display} ${unit}`
    } else {
      return `${closest.display} ${unit}`
    }
  }
  
  // Otherwise use decimal
  return `${decimal} ${unit}`
}
