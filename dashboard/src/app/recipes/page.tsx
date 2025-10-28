import React, { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, Filter, Plus, Flame, Heart, Clock, ChefHat, Bookmark } from 'lucide-react'
import PageHeader, { PageHeaderTab } from '../../components/layout/PageHeader'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useRecipes, useSavedRecipes, useRecipeCategoryAnalytics, useRecipeStats } from '../../lib/use-data'
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2'

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop'

const tabs: PageHeaderTab[] = [
  { id: 'trending', label: 'Trending', icon: <Flame size={16} /> },
  { id: 'favorites', label: 'Favorites', icon: <Heart size={16} /> },
  { id: 'saved', label: 'Saved', icon: <Bookmark size={16} /> },
  { id: 'mine', label: 'My Recipes', icon: <ChefHat size={16} /> },
]

const mealTypeFilters = ['all', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert']

type Recipe = {
  id: string
  title: string
  summary?: string
  description?: string
  image_url?: string
  cook_min?: number | null
  prep_min?: number | null
  created_by?: string | null
  dietary_tags?: string[] | null
  cuisine?: string | null
  is_public?: boolean
}

function getDuration(recipe: Recipe) {
  const total = (recipe.prep_min || 0) + (recipe.cook_min || 0)
  if (!total) return 'Flexible time'
  return `${total} min`
}

function RecipeCard({
  recipe,
  isSaved,
  onToggleSaved,
}: {
  recipe: Recipe
  isSaved: boolean
  onToggleSaved: (id: string) => void
}) {
  return (
    <Card className="recipe-card">
      <div className="recipe-media">
        <img src={recipe.image_url || DEFAULT_IMAGE} alt={recipe.title} />
        <button className={clsx('save-toggle', { saved: isSaved })} onClick={() => onToggleSaved(recipe.id)}>
          <Heart size={16} />
        </button>
      </div>
      <CardContent className="recipe-body">
        <div className="recipe-badges">
          {recipe.cuisine && <Badge variant="neutral">{recipe.cuisine}</Badge>}
          {recipe.dietary_tags?.slice(0, 2).map(tag => (
            <Badge key={tag} variant="brand">{tag}</Badge>
          ))}
        </div>
        <h3>{recipe.title}</h3>
        <p>{recipe.summary || recipe.description || 'A delicious recipe ready for your next meal.'}</p>
        <div className="recipe-meta">
          <span className="meta-item"><Clock size={14} />{getDuration(recipe)}</span>
          {recipe.is_public && <span className="meta-item"><Flame size={14} />Popular</span>}
        </div>
      </CardContent>
      <style jsx>{`
        .recipe-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform var(--transition-normal), box-shadow var(--transition-normal);
        }

        .recipe-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .recipe-media {
          position: relative;
          aspect-ratio: 4 / 3;
          overflow: hidden;
        }

        .recipe-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--transition-normal);
        }

        .recipe-card:hover img {
          transform: scale(1.05);
        }

        .save-toggle {
          position: absolute;
          top: var(--space-3);
          right: var(--space-3);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.92);
          color: var(--text-muted);
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .save-toggle:hover,
        .save-toggle.saved {
          color: var(--danger);
        }

        .recipe-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .recipe-body h3 {
          margin: 0;
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .recipe-body p {
          margin: 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.5;
        }

        .recipe-badges {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .recipe-meta {
          display: flex;
          gap: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
        }
      `}</style>
    </Card>
  )
}

function MetricCard({ label, value, icon, tone = 'default' }: { label: string; value: string; icon: React.ReactNode; tone?: 'default' | 'success' | 'danger' }) {
  return (
    <div className={clsx('metric-card', { success: tone === 'success', danger: tone === 'danger' })}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <span className="metric-label">{label}</span>
        <span className="metric-value">{value}</span>
      </div>
      <style jsx>{`
        .metric-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          background: var(--panel);
        }

        .metric-card.success {
          border-color: rgba(34, 197, 94, 0.25);
        }

        .metric-card.danger {
          border-color: rgba(248, 113, 113, 0.3);
        }

        .metric-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--panel-2);
          color: var(--brand-600);
        }

        .metric-card.success .metric-icon {
          color: #16a34a;
        }

        .metric-card.danger .metric-icon {
          color: #dc2626;
        }

        .metric-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .metric-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .metric-value {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
        }
      `}</style>
    </div>
  )
}

export default function Recipes() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('trending')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')

  const { data: recipeStats, loading: statsLoading } = useRecipeStats()
  const { data: categoryAnalytics } = useRecipeCategoryAnalytics()
  const { data: recipes, loading: recipesLoading } = useRecipes({
    limit: 40,
    searchTerm: searchTerm || undefined,
    mealTypes: selectedFilter !== 'all' ? [selectedFilter.toLowerCase()] : undefined,
  })
  const { data: savedRecipes } = useSavedRecipes()

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (savedRecipes) {
      setSavedIds(new Set(savedRecipes.map((recipe: Recipe) => recipe.id)))
    }
  }, [savedRecipes])

  const recipesToRender = useMemo(() => {
    const list = recipes || []

    if (activeTab === 'favorites') {
      return list.filter((recipe: Recipe) => savedIds.has(recipe.id))
    }

    if (activeTab === 'saved') {
      return savedRecipes || []
    }

    if (activeTab === 'mine') {
      return list.filter((recipe: Recipe) => recipe.created_by === user?.id)
    }

    return list
  }, [recipes, activeTab, savedRecipes, savedIds, user?.id])

  const topCategories = categoryAnalytics?.categories?.slice(0, 6) || []

  const handleToggleSaved = (id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="recipes-page">
      <PageHeader
        title="Recipes"
        description="Discover, personalise, and manage the meals that keep your household happy."
        primaryAction={{
          label: 'Add Recipe',
          icon: <Plus size={16} />,
          onClick: () => {
            // TODO: wire to creation modal
            console.log('Open recipe creation flow')
          },
        }}
        secondaryActions={[{ label: 'Filters', icon: <Filter size={16} />, onClick: () => null, variant: 'outline' }]}
        tabs={tabs.map(tab => ({
          ...tab,
          count:
            tab.id === 'favorites'
              ? savedIds.size
              : tab.id === 'saved'
              ? savedRecipes?.length || 0
              : tab.id === 'mine'
              ? recipes?.filter((recipe: Recipe) => recipe.created_by === user?.id).length || 0
              : recipes?.length || 0,
        }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="header-grid">
          <div className="search-panel">
            <div className="search-input">
              <Search size={18} />
              <input
                placeholder="Search recipes, cuisines, or ingredients"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
            </div>
            <p className="search-hint">Tip: try “high protein breakfast” or “vegetarian dinner under 30 minutes”.</p>
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Total Recipes"
              value={statsLoading ? '—' : String(recipeStats?.totalRecipes ?? 0)}
              icon={<ChefHat size={18} />}
            />
            <MetricCard
              label="My Creations"
              value={statsLoading ? '—' : String(recipeStats?.userRecipes ?? 0)}
              icon={<Bookmark size={18} />}
              tone="success"
            />
            <MetricCard
              label="Average Rating"
              value={statsLoading ? '—' : `${recipeStats?.averageRating ?? 0} ★`}
              icon={<Heart size={18} />}
            />
            <MetricCard
              label="Popular Cuisine"
              value={statsLoading ? '—' : recipeStats?.mostPopularCuisine || 'Discovering'}
              icon={<Flame size={18} />}
              tone="danger"
            />
          </div>
        </div>
      </PageHeader>

      {topCategories.length > 0 && (
        <div className="category-chips">
          {topCategories.map((category: any) => (
            <button
              key={category.name}
              className={clsx('category-chip', { active: selectedFilter === category.name.toLowerCase() })}
              onClick={() => setSelectedFilter(category.name.toLowerCase())}
            >
              {category.name}
              <span>{category.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="filter-row">
        {mealTypeFilters.map(filter => (
          <button
            key={filter}
            className={clsx('filter-pill', { active: selectedFilter === filter })}
            onClick={() => setSelectedFilter(filter)}
          >
            {filter === 'all' ? 'All meals' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="recipes-grid">
        {recipesLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="recipe-skeleton" />
          ))
        ) : recipesToRender.length === 0 ? (
          <Card className="empty-card">
            <CardContent>
              <h3>No recipes found</h3>
              <p>Try adjusting your filters or create a new recipe to get started.</p>
              <Button variant="solid" size="sm" leftIcon={<Plus size={16} />}>Create recipe</Button>
            </CardContent>
          </Card>
        ) : (
          recipesToRender.map((recipe: Recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isSaved={savedIds.has(recipe.id)}
              onToggleSaved={handleToggleSaved}
            />
          ))
        )}
      </div>

      <style jsx>{`
        .recipes-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .header-grid {
          display: grid;
          gap: var(--space-4);
        }

        .search-panel {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding: var(--space-4);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background: var(--panel);
        }

        .search-input {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          border-radius: var(--radius-lg);
          background: var(--panel-2);
          border: 1px solid transparent;
        }

        .search-input input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text);
          font-size: var(--text-sm);
          outline: none;
        }

        .search-hint {
          margin: 0;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-3);
        }

        .category-chips {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .category-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text-muted);
          font-size: var(--text-sm);
          transition: all var(--transition-fast);
        }

        .category-chip:hover,
        .category-chip.active {
          border-color: var(--brand-500);
          color: var(--brand-600);
          background: rgba(59, 130, 246, 0.08);
        }

        .category-chip span {
          display: inline-flex;
          min-width: 20px;
          justify-content: center;
          background: var(--panel-2);
          border-radius: var(--radius-full);
          padding: 0 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .filter-row {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .filter-pill {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-full);
          border: 1px solid transparent;
          background: var(--panel-2);
          color: var(--text-muted);
          font-size: var(--text-sm);
          transition: all var(--transition-fast);
        }

        .filter-pill:hover,
        .filter-pill.active {
          border-color: var(--brand-400);
          color: var(--brand-600);
          background: rgba(59, 130, 246, 0.1);
        }

        .recipes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: var(--space-4);
        }

        .recipe-skeleton {
          height: 340px;
          border-radius: var(--radius-lg);
          background: linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.14) 25%,
            rgba(148, 163, 184, 0.26) 50%,
            rgba(148, 163, 184, 0.14) 75%
          );
          animation: shimmer 1.6s infinite;
        }

        .empty-card {
          grid-column: 1 / -1;
        }

        .empty-card h3 {
          margin: 0 0 var(--space-2) 0;
        }

        .empty-card p {
          margin: 0 0 var(--space-4) 0;
          color: var(--text-muted);
        }

        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }

        @media (max-width: 767px) {
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .recipes-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}




