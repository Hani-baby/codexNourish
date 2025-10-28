import React, { useEffect, useMemo, useState } from 'react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Badge from '../../../components/ui/Badge'
import { MealPlan } from '../mock-data'
import { CalendarRange, Plus, X } from 'lucide-react'

export interface ManualPlanDraft {
  title: string
  startDate: string
  endDate: string
  mealsPerDay: number
  notes: string
}

interface ManualPlanModalProps {
  isOpen: boolean
  existingPlans: MealPlan[]
  onClose: () => void
  onCreate: (draft: ManualPlanDraft) => void
}

export default function ManualPlanModal({ isOpen, existingPlans, onClose, onCreate }: ManualPlanModalProps) {
  const blockedRanges = useMemo(() => existingPlans.map(plan => ({ start: plan.startDate, end: plan.endDate, title: plan.title })), [existingPlans])

  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(addDays(todayIso(), 6))
  const [mealsPerDay, setMealsPerDay] = useState(3)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setTitle('')
      setStartDate(todayIso())
      setEndDate(addDays(todayIso(), 6))
      setMealsPerDay(3)
      setNotes('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const conflicts = findConflicts(startDate, endDate, blockedRanges)
  const validRange = startDate <= endDate && conflicts.length === 0

  const handleSubmit = () => {
    if (!validRange) return
    if (!title.trim()) {
      // Could add error state here if needed
      return
    }
    onCreate({
      title: title.trim(),
      startDate,
      endDate,
      mealsPerDay,
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <div>
            <h2>Build a plan manually</h2>
            <p>Lock the schedule exactly how you want it. You can still ask Chef Nourish to fill individual slots later.</p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close manual plan modal">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <Input
            label="Plan name"
            placeholder="e.g. Family weeknights"
            value={title}
            onChange={event => setTitle(event.target.value)}
          />

          <div className="date-grid">
            <label>
              <span>Start date</span>
              <input
                type="date"
                min={todayIso()}
                value={startDate}
                onChange={event => {
                  const value = event.target.value
                  setStartDate(value)
                  if (value > endDate) {
                    setEndDate(value)
                  }
                }}
              />
            </label>
            <label>
              <span>End date</span>
              <input
                type="date"
                min={startDate}
                value={endDate}
                onChange={event => setEndDate(event.target.value)}
              />
            </label>
          </div>

          <div className="meals-picker">
            <span>Meals per day</span>
            <div className="meals-options">
              {[2, 3, 4, 5, 6].map(count => (
                <button
                  key={count}
                  type="button"
                  className={`meals-chip ${count === mealsPerDay ? 'active' : ''}`}
                  onClick={() => setMealsPerDay(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span>Notes</span>
            <textarea
              placeholder="Example: Prep double portions for Monday and Wednesday lunches."
              rows={4}
              value={notes}
              onChange={event => setNotes(event.target.value)}
            />
          </label>

          {conflicts.length > 0 && (
            <div className="conflict-warning">
              Those dates overlap with {conflicts.map(range => range.title).join(', ')}.
            </div>
          )}

          <div className="blocked-list">
            <h4>Already scheduled</h4>
            <ul>
              {blockedRanges.map(range => (
                <li key={`${range.start}-${range.end}`}>
                  <CalendarRange size={16} />
                  <span>{formatRangeLabel(range.start, range.end)}</span>
                  <Badge variant="neutral" size="xs">{range.title}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="modal-footer">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} leftIcon={<Plus size={16} />} disabled={!validRange || !title.trim()}>
            Start manual plan
          </Button>
        </footer>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          z-index: 35;
        }

        .modal {
          width: min(540px, 100%);
          background: var(--panel);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border-strong);
          box-shadow: 0 18px 46px rgba(15, 23, 42, 0.24);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: var(--space-8) var(--space-8) var(--space-6);
          gap: var(--space-4);
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          padding: 0 var(--space-8) var(--space-8);
          overflow-y: auto;
        }

        .modal-header h2 {
          margin: 0;
          font-size: var(--text-lg);
        }

        .modal-header p {
          margin: var(--space-3) 0 0 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.5;
        }

        .close-button {
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          padding: var(--space-1);
        }

        .date-grid {
          display: grid;
          gap: var(--space-4);
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }

        label span {
          display: block;
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: var(--space-2);
        }

        input[type='date'],
        textarea {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          background: var(--input-bg);
          color: var(--text);
        }

        .meals-picker {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .meals-options {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .meals-chip {
          border: 1px solid var(--border);
          background: var(--panel-2);
          border-radius: var(--radius-full);
          padding: 8px 14px;
          cursor: pointer;
          color: var(--text);
        }

        .meals-chip.active {
          background: var(--brand-500);
          border-color: var(--brand-500);
          color: white;
        }

        .conflict-warning {
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          color: var(--danger);
          font-size: var(--text-sm);
          line-height: 1.5;
        }

        .blocked-list h4 {
          margin: 0;
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }

        .blocked-list ul {
          margin: var(--space-3) 0 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: var(--space-3);
        }

        .blocked-list li {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          background: var(--panel-2);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-4);
          gap: var(--space-3);
          font-size: var(--text-sm);
        }

        .blocked-list li svg {
          color: var(--text-muted);
        }

        .modal-footer {
          padding: var(--space-6) var(--space-8);
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          border-top: 1px solid var(--border);
          background: var(--panel);
        }

        @media (max-width: 768px) {
          .modal {
            height: 100%;
            border-radius: 0;
          }

          .modal-body {
            padding: 0 var(--space-6) var(--space-6);
          }
        }
      `}</style>
    </div>
  )
}

function findConflicts(start: string, end: string, ranges: Array<{ start: string; end: string; title: string }>) {
  if (!start || !end) return []
  if (start > end) return []
  return ranges.filter(range => rangesOverlap(start, end, range.start, range.end))
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd)
}

function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function formatRangeLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return `${formatter.format(new Date(start))} — ${formatter.format(new Date(end))}`
}
