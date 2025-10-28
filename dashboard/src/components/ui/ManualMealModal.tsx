import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
import Button from './Button'
import Input from './Input'
import { Search, Plus, X, ChefHat, Clock, Loader2, StickyNote } from 'lucide-react'
import { getRecipes } from '../../lib/data-services'
import { supabase } from '../../lib/supabase'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1478144592103-25e218a04891?w=400&h=260&fit=crop'

type TabKey = 'search' | 'manual'

type RecipeResult = {
  id: string
  title: string
  summary?: string | null
  image_url?: string | null
  prep_min?: number | null
  cook_min?: number | null
  cuisine?: string | null
}

export type ManualMealModalSelection =
  | { kind: 'recipe'; recipe: RecipeResult }
  | { kind: 'manual'; title: string; notes?: string }

interface ManualMealModalProps {
  isOpen: boolean
  onClose: () => void
  targetDate: string
  mealType: string
  onSubmit: (selection: ManualMealModalSelection) => Promise<void> | void
}

export default function ManualMealModal({ isOpen, onClose, targetDate, mealType, onSubmit }: ManualMealModalProps) {
  const [tab, setTab] = useState<TabKey>('search')
  const [query, setQuery] = useState('')
  const [recipes, setRecipes] = useState<RecipeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [manualTitle, setManualTitle] = useState('')
  const [manualNotes, setManualNotes] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setRecipes([])
      setErrorMessage(null)
      setManualTitle('')
      setManualNotes('')
      setTab('search')
      return
    }

    let isCancelled = false
    const controller = new AbortController()

    const fetchRecipes = async (searchTerm: string) => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const { data, error } = await getRecipes({
          searchTerm: searchTerm.trim() || undefined,
          limit: 24
        })

        if (isCancelled) return

        if (error) {
          setErrorMessage(error.message)
          setRecipes([])
          return
        }

        const unique = new Map<string, RecipeResult>()
        (data || []).forEach(recipe => {
          if (recipe?.id && !unique.has(recipe.id)) {
            unique.set(recipe.id, recipe as RecipeResult)
          }
        })
        setRecipes(Array.from(unique.values()))
      } catch (err) {
        if (isCancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load recipes'
        setErrorMessage(message)
        setRecipes([])
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    const timeout = setTimeout(() => {
      fetchRecipes(query)
    }, 250)

    return () => {
      isCancelled = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [isOpen, query])

  const handleSelectRecipe = async (recipe: RecipeResult) => {
    try {
      setIsSubmitting(true)
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, summary, image_url, prep_min, cook_min, cuisine')
        .eq('id', recipe.id)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        throw new Error('Recipe no longer exists. Please refresh and try again.')
      }

      await onSubmit({ kind: 'recipe', recipe: data as RecipeResult })
      handleClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to add recipe'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleManualSubmit = async () => {
    if (!manualTitle.trim()) {
      setErrorMessage('Please provide a meal name for manual entry.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        kind: 'manual',
        title: manualTitle.trim(),
        notes: manualNotes.trim() || undefined,
      })
      handleClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setManualTitle('')
    setManualNotes('')
    setErrorMessage(null)
    setQuery('')
    onClose()
  }

  const debouncePlaceholder = useMemo(() => {
    if (!query.trim()) return 'Search your recipes...'
    return `Searching for “${query.trim()}”...`
  }, [query])

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <Card>
          <CardHeader>
            <div className="modal-header">
              <div>
                <CardTitle>Add Meal Manually</CardTitle>
                <CardDescription>
                  {new Date(targetDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} · {mealType}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X size={16} />
              </Button>
            </div>
            <div className="tabs">
              <button
                className={`tab ${tab === 'search' ? 'active' : ''}`}
                onClick={() => setTab('search')}
              >
                <Search size={14} /> Search recipes
              </button>
              <button
                className={`tab ${tab === 'manual' ? 'active' : ''}`}
                onClick={() => setTab('manual')}
              >
                <Plus size={14} /> Manual entry
              </button>
            </div>
          </CardHeader>

          {tab === 'search' ? (
            <CardContent>
              <div className="search-row">
                <Input
                  placeholder="Search recipes..."
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  icon={<Search size={16} />}
                />
              </div>

              <div className="recipes-grid">
                {loading && (
                  <div className="recipes-message">
                    <Loader2 className="spin" size={16} /> {debouncePlaceholder}
                  </div>
                )}

                {!loading && errorMessage && (
                  <div className="recipes-message error">
                    <X size={16} /> {errorMessage}
                  </div>
                )}

                {!loading && !errorMessage && recipes.length === 0 && (
                  <div className="recipes-message empty">
                    <ChefHat size={24} />
                    <span>No recipes found. Try a different search term.</span>
                  </div>
                )}

                {!loading && !errorMessage && recipes.map(recipe => (
                  <div key={recipe.id} className="recipe-card">
                    <div className="thumb">
                      <img src={recipe.image_url || FALLBACK_IMAGE} alt={recipe.title} />
                    </div>
                    <div className="recipe-info">
                      <div className="recipe-title">{recipe.title}</div>
                      {recipe.summary && <p className="recipe-summary">{recipe.summary}</p>}
                      <div className="recipe-meta">
                        <span className="meta-item">
                          <Clock size={12} /> {(recipe.prep_min || 0) + (recipe.cook_min || 0) || 15}m
                        </span>
                        {recipe.cuisine && (
                          <span className="meta-item">
                            <ChefHat size={12} /> {recipe.cuisine}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSelectRecipe(recipe)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Adding…' : `Add to ${mealType}`}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <div className="form-grid">
                <label className="col-span-2">
                  <span>Meal title *</span>
                  <Input
                    value={manualTitle}
                    onChange={event => setManualTitle(event.target.value)}
                    placeholder="e.g., Lemon herb salmon bowls"
                    icon={<ChefHat size={16} />}
                  />
                </label>
                <label className="col-span-2">
                  <span>Notes (optional)</span>
                  <textarea
                    className="textarea"
                    value={manualNotes}
                    onChange={event => setManualNotes(event.target.value)}
                    rows={3}
                    placeholder="Sides, reminders, or prep instructions"
                  />
                </label>
              </div>
            </CardContent>
          )}

          <CardFooter className="modal-footer">
            <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {tab === 'search' ? (
              <Button onClick={() => query && setQuery('')} variant="outline" disabled={loading || !query}>
                Clear search
              </Button>
            ) : (
              <Button onClick={handleManualSubmit} disabled={!manualTitle.trim() || isSubmitting}>
                {isSubmitting ? 'Adding…' : 'Add manual meal'}
              </Button>
            )}
          </CardFooter>
        </Card>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: var(--space-4);
          }
          .modal-container {
            width: 100%;
            max-width: 720px;
            max-height: 90vh;
            overflow-y: auto;
          }
          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-3);
          }
          .tabs {
            margin-top: var(--space-4);
            display: flex;
            gap: var(--space-2);
          }
          .tab {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-2);
            padding: var(--space-3);
            background: var(--panel-2);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            color: var(--text-muted);
            font-size: var(--text-sm);
            cursor: pointer;
            transition: all var(--transition-fast);
          }
          .tab.active {
            background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
            border-color: transparent;
            color: #fff;
            box-shadow: 0 8px 20px rgba(21, 181, 107, 0.25);
          }
          .search-row {
            display: flex;
            gap: var(--space-3);
          }
          .recipes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: var(--space-4);
            margin-top: var(--space-5);
          }
          .recipes-message {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-2);
            padding: var(--space-4);
            border: 1px dashed var(--border);
            border-radius: var(--radius-lg);
            color: var(--text-muted);
            font-size: var(--text-sm);
          }
          .recipes-message.error {
            border-color: rgba(248, 113, 113, 0.6);
            color: #b91c1c;
          }
          .recipes-message.empty {
            flex-direction: column;
            text-align: center;
          }
          .recipe-card {
            display: flex;
            flex-direction: column;
            border-radius: var(--radius-xl);
            overflow: hidden;
            border: 1px solid var(--border);
            background: var(--panel);
            box-shadow: var(--shadow-sm);
            transition: transform var(--transition-fast), box-shadow var(--transition-fast);
          }
          .recipe-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
          }
          .thumb {
            position: relative;
            height: 150px;
            background: var(--panel-2);
            overflow: hidden;
          }
          .thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform var(--transition-fast);
          }
          .recipe-card:hover .thumb img {
            transform: scale(1.04);
          }
          .recipe-info {
            padding: var(--space-4);
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
          }
          .recipe-title {
            font-weight: var(--font-semibold);
            font-size: var(--text-base);
            color: var(--text);
          }
          .recipe-summary {
            color: var(--text-muted);
            font-size: var(--text-sm);
            line-height: 1.4;
          }
          .recipe-meta {
            display: flex;
            flex-wrap: wrap;
            gap: var(--space-3);
            font-size: var(--text-xs);
            color: var(--text-muted);
          }
          .meta-item {
            display: flex;
            align-items: center;
            gap: var(--space-1);
          }
          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: var(--space-4);
          }
          .col-span-2 {
            grid-column: span 2;
          }
          label span {
            display: block;
            margin-bottom: var(--space-2);
            color: var(--text-muted);
            font-size: var(--text-xs);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .textarea {
            width: 100%;
            padding: var(--space-4);
            border-radius: var(--radius-lg);
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--input-text);
            font-size: var(--text-sm);
            resize: vertical;
            min-height: 120px;
          }
          .modal-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: var(--space-3);
          }
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @media (max-width: 640px) {
            .modal-container {
              height: 100vh;
              max-height: 100vh;
            }
            .form-grid {
              grid-template-columns: 1fr;
            }
            .col-span-2 {
              grid-column: span 1;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
