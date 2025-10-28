import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Calendar,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react'
import { 
  getUserInventory, 
  addToInventory, 
  updateInventoryItem, 
  removeFromInventory,
  getExpiringItems,
  IngredientInventory 
} from '../../lib/grocery-service'

interface Props {
  householdId: string
}

interface NewIngredientForm {
  ingredient_name: string
  quantity_available: number
  unit: string
  expiry_date?: string
  location?: string
  notes?: string
}

export default function PantryInventoryManager({ householdId }: Props) {
  const [inventory, setInventory] = useState<IngredientInventory[]>([])
  const [expiringItems, setExpiringItems] = useState<IngredientInventory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showExpiringSoon, setShowExpiringSoon] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<IngredientInventory | null>(null)
  const [newIngredient, setNewIngredient] = useState<NewIngredientForm>({
    ingredient_name: '',
    quantity_available: 0,
    unit: 'unit'
  })

  useEffect(() => {
    loadInventory()
    loadExpiringItems()
  }, [householdId])

  const loadInventory = async () => {
    try {
      setIsLoading(true)
      const inventoryData = await getUserInventory()
      setInventory(inventoryData)
    } catch (error) {
      console.error('Error loading inventory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadExpiringItems = async () => {
    try {
      const expiring = await getExpiringItems(7) // Next 7 days
      setExpiringItems(expiring)
    } catch (error) {
      console.error('Error loading expiring items:', error)
    }
  }

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addToInventory(newIngredient)
      setNewIngredient({
        ingredient_name: '',
        quantity_available: 0,
        unit: 'unit'
      })
      setShowAddForm(false)
      await loadInventory()
      await loadExpiringItems()
    } catch (error) {
      console.error('Error adding ingredient:', error)
    }
  }

  const handleUpdateIngredient = async (item: IngredientInventory) => {
    try {
      await updateInventoryItem(item.id, item)
      setEditingItem(null)
      await loadInventory()
      await loadExpiringItems()
    } catch (error) {
      console.error('Error updating ingredient:', error)
    }
  }

  const handleDeleteIngredient = async (itemId: string) => {
    if (window.confirm('Are you sure you want to remove this item from your pantry?')) {
      try {
        await removeFromInventory(itemId)
        await loadInventory()
        await loadExpiringItems()
      } catch (error) {
        console.error('Error deleting ingredient:', error)
      }
    }
  }

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.ingredient_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = !showExpiringSoon || expiringItems.some(exp => exp.id === item.id)
    return matchesSearch && matchesFilter
  })

  const getDaysUntilExpiry = (expiryDate: string): number => {
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  const getExpiryBadgeColor = (expiryDate: string): string => {
    const days = getDaysUntilExpiry(expiryDate)
    if (days <= 0) return 'bg-red-100 text-red-800 border-red-200'
    if (days <= 3) return 'bg-orange-100 text-orange-800 border-orange-200'
    if (days <= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Pantry Inventory
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadInventory()
                  loadExpiringItems()
                }}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm mb-4">
            <div>
              <div className="font-semibold text-lg">{inventory.length}</div>
              <div className="text-gray-600">Total Items</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-red-600">{expiringItems.length}</div>
              <div className="text-gray-600">Expiring Soon</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-green-600">
                {inventory.filter(item => item.quantity_available > 0).length}
              </div>
              <div className="text-gray-600">In Stock</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-gray-600">
                {inventory.filter(item => item.quantity_available === 0).length}
              </div>
              <div className="text-gray-600">Out of Stock</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search ingredients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showExpiringSoon}
                onChange={(e) => setShowExpiringSoon(e.target.checked)}
                className="rounded"
              />
              <Filter className="w-4 h-4" />
              Show expiring soon
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Expiring Items Alert */}
      {expiringItems.length > 0 && !showExpiringSoon && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">
                {expiringItems.length} item{expiringItems.length > 1 ? 's' : ''} expiring in the next 7 days
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExpiringSoon(true)}
                className="ml-auto"
              >
                View Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Ingredient Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Ingredient</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddIngredient} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Ingredient Name</label>
                  <input
                    type="text"
                    required
                    value={newIngredient.ingredient_name}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, ingredient_name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Chicken Breast"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      required
                      value={newIngredient.quantity_available}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, quantity_available: parseFloat(e.target.value) }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unit</label>
                    <select
                      value={newIngredient.unit}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="unit">units</option>
                      <option value="g">grams</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="L">liters</option>
                      <option value="cup">cups</option>
                      <option value="tbsp">tablespoons</option>
                      <option value="tsp">teaspoons</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={newIngredient.expiry_date || ''}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, expiry_date: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Location (Optional)</label>
                  <input
                    type="text"
                    value={newIngredient.location || ''}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Refrigerator, Pantry"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
                <textarea
                  value={newIngredient.notes || ''}
                  onChange={(e) => setNewIngredient(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button type="submit">Add to Pantry</Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Inventory List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="text-center py-8">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
              <p className="text-gray-600">Loading inventory...</p>
            </CardContent>
          </Card>
        ) : filteredInventory.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || showExpiringSoon ? 'No items found' : 'No items in pantry'}
              </h3>
              <p className="text-gray-600">
                {searchTerm || showExpiringSoon 
                  ? 'Try adjusting your search or filters'
                  : 'Add your first ingredient to start tracking your pantry inventory'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredInventory.map(item => (
            <Card key={item.id} className="transition-all hover:shadow-md">
              <CardContent className="py-4">
                {editingItem?.id === item.id ? (
                  // Edit Form
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Quantity</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={editingItem.quantity_available}
                          onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, quantity_available: parseFloat(e.target.value) }) : null)}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={editingItem.expiry_date || ''}
                          onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, expiry_date: e.target.value }) : null)}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Location</label>
                        <input
                          type="text"
                          value={editingItem.location || ''}
                          onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, location: e.target.value }) : null)}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleUpdateIngredient(editingItem)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Display View
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-lg">{item.ingredient_name}</h3>
                        
                        {/* Quantity Badge */}
                        <Badge 
                          variant={item.quantity_available > 0 ? "default" : "secondary"}
                          className="text-sm"
                        >
                          {item.quantity_available} {item.unit}
                        </Badge>
                        
                        {/* Expiry Badge */}
                        {item.expiry_date && (
                          <Badge className={`text-xs ${getExpiryBadgeColor(item.expiry_date)}`}>
                            <Calendar className="w-3 h-3 mr-1" />
                            {getDaysUntilExpiry(item.expiry_date) <= 0 
                              ? 'Expired'
                              : `${getDaysUntilExpiry(item.expiry_date)} days`
                            }
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        {item.location && (
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            <span>Location: {item.location}</span>
                          </div>
                        )}
                        
                        {item.expiry_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Expires: {new Date(item.expiry_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        {item.notes && (
                          <div className="text-gray-500">
                            <span>{item.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingItem(item)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteIngredient(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
