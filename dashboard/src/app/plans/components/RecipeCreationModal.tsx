import React, { useState, useEffect } from 'react'
import { X, Clock, Users, ChefHat, AlertCircle, CheckCircle } from 'lucide-react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Badge from '../../../components/ui/Badge'
import { supabase } from '../../../lib/supabase'
import { generateRecipeSlug, ensureUniqueRecipeSlug, findRecipeByTitle } from '../../../lib/data-services'

interface RecipeCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onRecipeCreated: (recipe: any) => void
  mealType?: string
}

interface RecipeFormData {
  title: string
  summary: string
  instructions: string
  prepMin: number | null
  cookMin: number | null
  servings: number
  cuisine: string
  dietaryTags: string[]
  isPublic: boolean
}

const DIETARY_OPTIONS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 
  'keto', 'paleo', 'low-carb', 'high-protein', 'low-sodium'
]

const CUISINE_OPTIONS = [
  'American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 
  'Indian', 'French', 'Thai', 'Chinese', 'Japanese', 'Other'
]

export default function RecipeCreationModal({ 
  isOpen, 
  onClose, 
  onRecipeCreated, 
  mealType = 'dinner' 
}: RecipeCreationModalProps) {
  const [formData, setFormData] = useState<RecipeFormData>({
    title: '',
    summary: '',
    instructions: '',
    prepMin: null,
    cookMin: null,
    servings: 1,
    cuisine: '',
    dietaryTags: [],
    isPublic: false
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isChecking: boolean
    found: boolean
    existingRecipe?: any
  }>({ isChecking: false, found: false })

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '',
        summary: '',
        instructions: '',
        prepMin: null,
        cookMin: null,
        servings: 1,
        cuisine: '',
        dietaryTags: [],
        isPublic: false
      })
      setError(null)
      setDuplicateCheck({ isChecking: false, found: false })
    }
  }, [isOpen])

  // Check for duplicates when title changes
  useEffect(() => {
    if (!formData.title.trim() || formData.title.length < 3) {
      setDuplicateCheck({ isChecking: false, found: false })
      return
    }

    const checkDuplicate = async () => {
      setDuplicateCheck({ isChecking: true, found: false })
      try {
        const { data: existing } = await findRecipeByTitle(formData.title)
        setDuplicateCheck({ 
          isChecking: false, 
          found: !!existing,
          existingRecipe: existing
        })
      } catch (err) {
        setDuplicateCheck({ isChecking: false, found: false })
      }
    }

    const timeout = setTimeout(checkDuplicate, 500)
    return () => clearTimeout(timeout)
  }, [formData.title])

  const handleInputChange = (field: keyof RecipeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleDietaryTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(tag)
        ? prev.dietaryTags.filter(t => t !== tag)
        : [...prev.dietaryTags, tag]
    }))
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setError('Recipe title is required')
      return
    }

    if (duplicateCheck.found) {
      setError('A recipe with this title already exists. Please choose a different title.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('You must be logged in to create recipes')
      }

      // Generate unique slug
      const baseSlug = generateRecipeSlug(formData.title)
      const uniqueSlug = await ensureUniqueRecipeSlug(baseSlug)

      // Create recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          created_by: user.id,
          title: formData.title.trim(),
          slug: uniqueSlug,
          summary: formData.summary.trim() || null,
          instructions: formData.instructions.trim() || null,
          prep_min: formData.prepMin,
          cook_min: formData.cookMin,
          servings: formData.servings,
          dietary_tags: formData.dietaryTags.length > 0 ? formData.dietaryTags : null,
          cuisine: formData.cuisine || null,
          is_public: formData.isPublic
        })
        .select()
        .single()

      if (recipeError) {
        throw recipeError
      }

      // Add tags if any
      if (formData.dietaryTags.length > 0) {
        const tagInserts = formData.dietaryTags.map(tag => ({
          recipe_id: newRecipe.id,
          tag
        }))

        await supabase
          .from('recipe_tags')
          .insert(tagInserts)
      }

      onRecipeCreated(newRecipe)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUseExisting = () => {
    if (duplicateCheck.existingRecipe) {
      onRecipeCreated(duplicateCheck.existingRecipe)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <header className="modal-header">
          <div>
            <h2>Create New Recipe</h2>
            <p>Add your own recipe to use in this meal plan</p>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          {/* Title with duplicate checking */}
          <div className="form-group">
            <Input
              label="Recipe Title *"
              placeholder="e.g. Grandma's Pasta"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              error={duplicateCheck.found ? 'Recipe already exists' : undefined}
            />
            {duplicateCheck.isChecking && (
              <div className="duplicate-check">
                <div className="checking">Checking for duplicates...</div>
              </div>
            )}
            {duplicateCheck.found && duplicateCheck.existingRecipe && (
              <div className="duplicate-found">
                <AlertCircle size={16} />
                <span>A recipe with this title already exists:</span>
                <div className="existing-recipe">
                  <strong>{duplicateCheck.existingRecipe.title}</strong>
                  <Button size="sm" onClick={handleUseExisting}>
                    Use existing recipe
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="form-group">
            <label>
              <span>Summary</span>
              <textarea
                placeholder="Brief description of the recipe..."
                value={formData.summary}
                onChange={(e) => handleInputChange('summary', e.target.value)}
                rows={2}
              />
            </label>
          </div>

          {/* Time and servings */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <span>Prep Time (minutes)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="15"
                  value={formData.prepMin || ''}
                  onChange={(e) => handleInputChange('prepMin', e.target.value ? parseInt(e.target.value) : null)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                <span>Cook Time (minutes)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="30"
                  value={formData.cookMin || ''}
                  onChange={(e) => handleInputChange('cookMin', e.target.value ? parseInt(e.target.value) : null)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                <span>Servings *</span>
                <input
                  type="number"
                  min="1"
                  value={formData.servings}
                  onChange={(e) => handleInputChange('servings', parseInt(e.target.value) || 1)}
                />
              </label>
            </div>
          </div>

          {/* Cuisine */}
          <div className="form-group">
            <label>
              <span>Cuisine</span>
              <select
                value={formData.cuisine}
                onChange={(e) => handleInputChange('cuisine', e.target.value)}
              >
                <option value="">Select cuisine...</option>
                {CUISINE_OPTIONS.map(cuisine => (
                  <option key={cuisine} value={cuisine}>{cuisine}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Dietary tags */}
          <div className="form-group">
            <label>
              <span>Dietary Tags</span>
              <div className="tag-options">
                {DIETARY_OPTIONS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-option ${formData.dietaryTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => handleDietaryTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </label>
          </div>

          {/* Instructions */}
          <div className="form-group">
            <label>
              <span>Instructions</span>
              <textarea
                placeholder="Step-by-step cooking instructions..."
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                rows={4}
              />
            </label>
          </div>

          {/* Public/Private */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => handleInputChange('isPublic', e.target.checked)}
              />
              <span>Make this recipe public (others can see and use it)</span>
            </label>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title.trim() || duplicateCheck.found}
            leftIcon={<ChefHat size={16} />}
          >
            {isSubmitting ? 'Creating...' : 'Create Recipe'}
          </Button>
        </footer>

        <style jsx>{`
          .modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-4);
            z-index: 50;
          }

          .modal {
            width: min(600px, 100%);
            max-height: 90vh;
            background: var(--panel);
            border-radius: var(--radius-2xl);
            border: 1px solid var(--border-strong);
            box-shadow: 0 18px 46px rgba(15, 23, 42, 0.24);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: var(--space-6);
            border-bottom: 1px solid var(--border);
          }

          .modal-header h2 {
            margin: 0;
            font-size: var(--text-lg);
          }

          .modal-header p {
            margin: var(--space-2) 0 0 0;
            color: var(--text-muted);
            font-size: var(--text-sm);
          }

          .close-button {
            border: none;
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            padding: var(--space-1);
          }

          .modal-body {
            flex: 1;
            padding: var(--space-6);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }

          .form-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: var(--space-4);
          }

          label span {
            font-size: var(--text-sm);
            font-weight: 500;
            color: var(--text);
          }

          input, textarea, select {
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--space-2);
            background: var(--input-bg);
            color: var(--text);
            font-size: var(--text-sm);
          }

          .checkbox-label {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            cursor: pointer;
          }

          .duplicate-check {
            font-size: var(--text-xs);
            color: var(--text-muted);
          }

          .duplicate-found {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-3);
            background: var(--warning-50);
            border: 1px solid var(--warning-200);
            border-radius: var(--radius-md);
            font-size: var(--text-sm);
          }

          .existing-recipe {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            margin-top: var(--space-2);
          }

          .tag-options {
            display: flex;
            flex-wrap: wrap;
            gap: var(--space-2);
          }

          .tag-option {
            padding: var(--space-1) var(--space-2);
            border: 1px solid var(--border);
            border-radius: var(--radius-full);
            background: var(--panel-2);
            color: var(--text);
            font-size: var(--text-xs);
            cursor: pointer;
            transition: all 0.2s;
          }

          .tag-option:hover {
            background: var(--brand-50);
            border-color: var(--brand-200);
          }

          .tag-option.selected {
            background: var(--brand-500);
            border-color: var(--brand-500);
            color: white;
          }

          .error-message {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-3);
            background: var(--danger-50);
            border: 1px solid var(--danger-200);
            border-radius: var(--radius-md);
            color: var(--danger);
            font-size: var(--text-sm);
          }

          .modal-footer {
            padding: var(--space-6);
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: flex-end;
            gap: var(--space-3);
          }
        `}</style>
      </div>
    </div>
  )
}
