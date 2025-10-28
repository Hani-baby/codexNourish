import { supabase } from './supabase'

// Instacart API types and interfaces
export interface InstacartConfig {
  apiKey: string
  baseUrl: string
  partnerId: string
  storeId?: string
  zipCode?: string
}

export interface InstacartProduct {
  id: string
  name: string
  brand?: string
  size?: string
  price: number
  currency: string
  image_url?: string
  availability: 'available' | 'out_of_stock' | 'limited'
  category: string
  unit_price?: number
  unit_type?: string
  organic?: boolean
  store_specific_id?: string
}

export interface InstacartCartItem {
  product_id: string
  quantity: number
  special_instructions?: string
  substitution_preference?: 'allow' | 'deny' | 'specific'
  preferred_substitutions?: string[]
}

export interface InstacartCart {
  id: string
  items: InstacartCartItem[]
  subtotal: number
  tax: number
  fees: number
  total: number
  currency: string
  delivery_address?: string
  delivery_time_slot?: string
  status: 'draft' | 'submitted' | 'shopping' | 'delivered' | 'cancelled'
  checkout_url?: string
}

export interface ProductSearchOptions {
  query: string
  category?: string
  maxResults?: number
  priceRange?: { min: number; max: number }
  organic?: boolean
  storeId?: string
  zipCode?: string
}

export interface ProductMatchResult {
  confidence: number
  product: InstacartProduct
  reasons: string[]
}

// Main Instacart API service class
export class InstacartAPIService {
  private config: InstacartConfig
  private rateLimitDelay = 1000 // 1 second between requests
  private lastRequestTime = 0

  constructor(config: InstacartConfig) {
    this.config = config
  }

  // Rate limiting helper
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      )
    }
    this.lastRequestTime = Date.now()
  }

  // Make authenticated API request
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    await this.enforceRateLimit()

    const url = `${this.config.baseUrl}${endpoint}`
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Partner-ID': this.config.partnerId,
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Instacart API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  // Search for products
  async searchProducts(options: ProductSearchOptions): Promise<InstacartProduct[]> {
    const params = new URLSearchParams({
      q: options.query,
      limit: (options.maxResults || 20).toString()
    })

    if (options.category) params.append('category', options.category)
    if (options.organic !== undefined) params.append('organic', options.organic.toString())
    if (options.storeId) params.append('store_id', options.storeId)
    if (options.zipCode) params.append('zip_code', options.zipCode)
    if (options.priceRange) {
      params.append('min_price', options.priceRange.min.toString())
      params.append('max_price', options.priceRange.max.toString())
    }

    try {
      const response = await this.makeRequest<{
        products: InstacartProduct[]
        total: number
      }>(`/products/search?${params}`)

      return response.products || []
    } catch (error) {
      console.error('Error searching Instacart products:', error)
      throw error
    }
  }

  // Find best product match for an ingredient
  async findBestMatch(
    ingredientName: string, 
    quantity: number, 
    unit: string,
    category?: string
  ): Promise<ProductMatchResult | null> {
    // Clean and enhance search query
    const searchQuery = this.enhanceSearchQuery(ingredientName, quantity, unit)
    
    try {
      const products = await this.searchProducts({
        query: searchQuery,
        category,
        maxResults: 10,
        storeId: this.config.storeId,
        zipCode: this.config.zipCode
      })

      if (products.length === 0) {
        return null
      }

      // Score and rank products
      const scoredProducts = products.map(product => ({
        product,
        score: this.calculateMatchScore(ingredientName, quantity, unit, product),
        reasons: this.getMatchReasons(ingredientName, quantity, unit, product)
      }))

      // Sort by score and return best match
      scoredProducts.sort((a, b) => b.score - a.score)
      const bestMatch = scoredProducts[0]

      if (bestMatch.score > 0.5) { // Minimum confidence threshold
        return {
          confidence: bestMatch.score,
          product: bestMatch.product,
          reasons: bestMatch.reasons
        }
      }

      return null
    } catch (error) {
      console.error(`Error finding match for ${ingredientName}:`, error)
      return null
    }
  }

  // Create a new cart
  async createCart(): Promise<InstacartCart> {
    try {
      const response = await this.makeRequest<InstacartCart>('/carts', {
        method: 'POST',
        body: JSON.stringify({
          store_id: this.config.storeId,
          zip_code: this.config.zipCode
        })
      })

      return response
    } catch (error) {
      console.error('Error creating Instacart cart:', error)
      throw error
    }
  }

  // Add items to cart
  async addItemsToCart(cartId: string, items: InstacartCartItem[]): Promise<InstacartCart> {
    try {
      const response = await this.makeRequest<InstacartCart>(`/carts/${cartId}/items`, {
        method: 'POST',
        body: JSON.stringify({ items })
      })

      return response
    } catch (error) {
      console.error('Error adding items to cart:', error)
      throw error
    }
  }

  // Get cart details
  async getCart(cartId: string): Promise<InstacartCart> {
    try {
      return await this.makeRequest<InstacartCart>(`/carts/${cartId}`)
    } catch (error) {
      console.error('Error fetching cart:', error)
      throw error
    }
  }

  // Update cart item
  async updateCartItem(
    cartId: string, 
    productId: string, 
    quantity: number
  ): Promise<InstacartCart> {
    try {
      const response = await this.makeRequest<InstacartCart>(
        `/carts/${cartId}/items/${productId}`, 
        {
          method: 'PUT',
          body: JSON.stringify({ quantity })
        }
      )

      return response
    } catch (error) {
      console.error('Error updating cart item:', error)
      throw error
    }
  }

  // Remove item from cart
  async removeCartItem(cartId: string, productId: string): Promise<InstacartCart> {
    try {
      const response = await this.makeRequest<InstacartCart>(
        `/carts/${cartId}/items/${productId}`, 
        {
          method: 'DELETE'
        }
      )

      return response
    } catch (error) {
      console.error('Error removing cart item:', error)
      throw error
    }
  }

  // Get checkout URL for cart
  async getCheckoutUrl(cartId: string): Promise<string> {
    try {
      const response = await this.makeRequest<{ checkout_url: string }>(
        `/carts/${cartId}/checkout`
      )

      return response.checkout_url
    } catch (error) {
      console.error('Error getting checkout URL:', error)
      throw error
    }
  }

  // Private helper methods

  private enhanceSearchQuery(ingredientName: string, quantity: number, unit: string): string {
    let query = ingredientName.toLowerCase()
    
    // Remove common cooking terms that might confuse product search
    const cookingTerms = ['fresh', 'chopped', 'diced', 'minced', 'sliced', 'ground']
    cookingTerms.forEach(term => {
      query = query.replace(new RegExp(`\\b${term}\\b`, 'g'), '')
    })
    
    // Add quantity context for better matching
    if (quantity > 1 && unit !== 'unit') {
      query += ` ${quantity} ${unit}`
    }
    
    return query.trim()
  }

  private calculateMatchScore(
    ingredientName: string, 
    quantity: number, 
    unit: string, 
    product: InstacartProduct
  ): number {
    let score = 0
    const productName = product.name.toLowerCase()
    const searchName = ingredientName.toLowerCase()

    // Exact name match
    if (productName.includes(searchName)) {
      score += 0.8
    }

    // Partial name match
    const nameWords = searchName.split(' ')
    const matchedWords = nameWords.filter(word => 
      productName.includes(word) && word.length > 2
    )
    score += (matchedWords.length / nameWords.length) * 0.6

    // Brand preference (organic, etc.)
    if (product.organic && searchName.includes('organic')) {
      score += 0.1
    }

    // Size/quantity appropriateness
    if (product.size && unit !== 'unit') {
      const sizeScore = this.calculateSizeScore(quantity, unit, product.size)
      score += sizeScore * 0.2
    }

    // Availability
    if (product.availability === 'available') {
      score += 0.1
    } else if (product.availability === 'limited') {
      score += 0.05
    }

    // Price reasonableness (avoid extremely expensive items)
    if (product.price > 0 && product.price < 100) {
      score += 0.05
    }

    return Math.min(score, 1.0) // Cap at 1.0
  }

  private calculateSizeScore(quantity: number, unit: string, productSize: string): number {
    // This is a simplified size matching - could be enhanced with proper unit conversion
    const sizeStr = productSize.toLowerCase()
    const unitStr = unit.toLowerCase()
    
    // Look for unit matches in product size
    if (sizeStr.includes(unitStr) || unitStr.includes(sizeStr.split(' ')[0])) {
      return 1.0
    }
    
    // Look for quantity matches
    const quantityMatch = sizeStr.match(/(\d+(\.\d+)?)/g)
    if (quantityMatch) {
      const productQuantity = parseFloat(quantityMatch[0])
      const ratio = Math.min(quantity, productQuantity) / Math.max(quantity, productQuantity)
      return ratio
    }
    
    return 0.3 // Default partial score
  }

  private getMatchReasons(
    ingredientName: string, 
    quantity: number, 
    unit: string, 
    product: InstacartProduct
  ): string[] {
    const reasons: string[] = []
    const productName = product.name.toLowerCase()
    const searchName = ingredientName.toLowerCase()

    if (productName.includes(searchName)) {
      reasons.push('Exact name match')
    }

    if (product.organic) {
      reasons.push('Organic option')
    }

    if (product.availability === 'available') {
      reasons.push('Currently available')
    } else if (product.availability === 'limited') {
      reasons.push('Limited availability')
    } else {
      reasons.push('Out of stock')
    }

    if (product.size) {
      reasons.push(`Size: ${product.size}`)
    }

    if (product.brand) {
      reasons.push(`Brand: ${product.brand}`)
    }

    reasons.push(`Price: $${product.price.toFixed(2)}`)

    return reasons
  }
}

// Factory function to create Instacart service with environment config
export async function createInstacartService(): Promise<InstacartAPIService> {
  // In a real implementation, these would come from environment variables
  // For demo purposes, we'll use placeholder values
  const config: InstacartConfig = {
    apiKey: process.env.INSTACART_API_KEY || 'demo_api_key',
    baseUrl: process.env.INSTACART_API_URL || 'https://api.instacart.com/v2',
    partnerId: process.env.INSTACART_PARTNER_ID || 'nourish_dash',
    storeId: process.env.INSTACART_DEFAULT_STORE_ID,
    zipCode: process.env.INSTACART_DEFAULT_ZIP_CODE
  }

  return new InstacartAPIService(config)
}

// High-level function to create cart from grocery list
export async function createInstacartCartFromGroceryList(
  groceryListItems: Array<{
    ingredient_name: string
    quantity: number
    unit: string
    category?: string
  }>
): Promise<{
  cart: InstacartCart
  matches: Array<{
    ingredient_name: string
    match: ProductMatchResult | null
    added_to_cart: boolean
    error?: string
  }>
}> {
  const instacartService = await createInstacartService()
  
  try {
    // Create new cart
    const cart = await instacartService.createCart()
    
    // Find products for each ingredient
    const matches: Array<{
      ingredient_name: string
      match: ProductMatchResult | null
      added_to_cart: boolean
      error?: string
    }> = []

    const cartItems: InstacartCartItem[] = []

    for (const item of groceryListItems) {
      try {
        const match = await instacartService.findBestMatch(
          item.ingredient_name,
          item.quantity,
          item.unit,
          item.category
        )

        const matchResult = {
          ingredient_name: item.ingredient_name,
          match,
          added_to_cart: false
        }

        if (match && match.confidence > 0.7) {
          // High confidence match - add to cart
          cartItems.push({
            product_id: match.product.id,
            quantity: Math.max(1, Math.round(item.quantity)), // Ensure at least 1
            special_instructions: `For: ${item.ingredient_name} (${item.quantity} ${item.unit})`,
            substitution_preference: 'allow'
          })
          matchResult.added_to_cart = true
        }

        matches.push(matchResult)
      } catch (error) {
        matches.push({
          ingredient_name: item.ingredient_name,
          match: null,
          added_to_cart: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Add all items to cart at once
    if (cartItems.length > 0) {
      await instacartService.addItemsToCart(cart.id, cartItems)
    }

    // Get updated cart with items
    const updatedCart = await instacartService.getCart(cart.id)

    return {
      cart: updatedCart,
      matches
    }
  } catch (error) {
    console.error('Error creating Instacart cart:', error)
    throw error
  }
}

// Mock implementation for development/testing
export class MockInstacartService extends InstacartAPIService {
  constructor() {
    super({
      apiKey: 'mock_key',
      baseUrl: 'https://mock.instacart.com',
      partnerId: 'mock_partner'
    })
  }

  async searchProducts(options: ProductSearchOptions): Promise<InstacartProduct[]> {
    // Return mock products based on search query
    const mockProducts: InstacartProduct[] = [
      {
        id: `mock_${Math.random()}`,
        name: `${options.query} - Brand A`,
        brand: 'Brand A',
        size: '1 lb',
        price: Math.random() * 10 + 2,
        currency: 'USD',
        availability: 'available',
        category: options.category || 'grocery',
        organic: options.organic || false
      },
      {
        id: `mock_${Math.random()}`,
        name: `Organic ${options.query} - Brand B`,
        brand: 'Brand B',
        size: '2 lbs',
        price: Math.random() * 15 + 5,
        currency: 'USD',
        availability: 'available',
        category: options.category || 'grocery',
        organic: true
      }
    ]

    return mockProducts.slice(0, options.maxResults || 10)
  }

  async createCart(): Promise<InstacartCart> {
    return {
      id: `mock_cart_${Date.now()}`,
      items: [],
      subtotal: 0,
      tax: 0,
      fees: 2.99,
      total: 2.99,
      currency: 'USD',
      status: 'draft',
      checkout_url: `https://instacart.com/checkout/mock_cart_${Date.now()}`
    }
  }

  async addItemsToCart(cartId: string, items: InstacartCartItem[]): Promise<InstacartCart> {
    const mockTotal = items.reduce((sum, item) => sum + (Math.random() * 10 + 2) * item.quantity, 0)
    
    return {
      id: cartId,
      items,
      subtotal: mockTotal,
      tax: mockTotal * 0.08,
      fees: 2.99,
      total: mockTotal * 1.08 + 2.99,
      currency: 'USD',
      status: 'draft',
      checkout_url: `https://instacart.com/checkout/${cartId}`
    }
  }
}

// Environment-based service factory
export function getInstacartService(): InstacartAPIService {
  if (process.env.NODE_ENV === 'development' || !process.env.INSTACART_API_KEY) {
    return new MockInstacartService()
  }
  
  return new InstacartAPIService({
    apiKey: process.env.INSTACART_API_KEY!,
    baseUrl: process.env.INSTACART_API_URL || 'https://api.instacart.com/v2',
    partnerId: process.env.INSTACART_PARTNER_ID!,
    storeId: process.env.INSTACART_DEFAULT_STORE_ID,
    zipCode: process.env.INSTACART_DEFAULT_ZIP_CODE
  })
}
