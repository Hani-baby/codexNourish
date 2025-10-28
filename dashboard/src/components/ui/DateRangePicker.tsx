import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import EnhancedInput from './EnhancedInput';
import { getOccupiedDates } from '../../lib/data-services';
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  existingRanges?: Array<{ start: string; end: string; title: string }>;
  className?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabledDates?: string[];
  selectionMode?: 'single' | 'week' | 'custom';
  onSelectionModeChange?: (mode: 'single' | 'week' | 'custom') => void;
}

interface DateSuggestion {
  start: string;
  end: string;
  label: string;
  description: string;
  isAvailable: boolean;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  existingRanges = [],
  className = '',
  label = 'Date Range',
  hint,
  error,
  disabledDates = [],
  selectionMode = 'custom',
  onSelectionModeChange
}: DateRangePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [occupiedData, setOccupiedData] = useState<{
    occupiedDates: string[];
    occupiedRanges: Array<{ start: string; end: string; title: string }>;
  }>({ occupiedDates: [], occupiedRanges: [] });
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();

  // Fetch occupied dates from database
  useEffect(() => {
    const fetchOccupiedDates = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      const { data, error } = await getOccupiedDates(user.id);
      
      if (error) {
        console.error('Failed to fetch occupied dates:', error);
      } else {
        setOccupiedData(data);
      }
      setLoading(false);
    };

    fetchOccupiedDates();
  }, [user?.id]);

  // Generate disabled dates (past dates + existing meal plan dates)
  const allDisabledDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const pastDates = [];
    const existingDates = [];
    
    // Add all dates from existing ranges
    existingRanges.forEach(range => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      const current = new Date(start);
      
      while (current <= end) {
        existingDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });
    
    return [...disabledDates, ...existingDates];
  }, [existingRanges, disabledDates]);

  // Find first free date (today or next available)
  const getFirstFreeDate = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const allRanges = [...existingRanges, ...occupiedData.occupiedRanges];
    
    // Check if today is free
    if (!isDateOccupied(todayStr, allRanges)) {
      return todayStr;
    }
    
    // Find next free date
    let currentDate = new Date(today);
    for (let i = 0; i < 30; i++) { // Check up to 30 days ahead
      currentDate.setDate(currentDate.getDate() + 1);
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!isDateOccupied(dateStr, allRanges)) {
        return dateStr;
      }
    }
    
    return todayStr; // Fallback to today
  };

  // Find next available full week (7 consecutive days)
  const getNextFreeWeek = () => {
    const allRanges = [...existingRanges, ...occupiedData.occupiedRanges];
    const today = new Date();
    
    // Start checking from today
    let currentDate = new Date(today);
    for (let i = 0; i < 60; i++) { // Check up to 60 days ahead
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6); // 7 days total
      
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      
      // Check if entire 7-day period is free
      if (!hasOverlap(weekStartStr, weekEndStr, allRanges)) {
        // Double-check by testing each individual day in the week
        let isWeekFree = true;
        for (let j = 0; j < 7; j++) {
          const checkDate = new Date(weekStart);
          checkDate.setDate(weekStart.getDate() + j);
          const checkDateStr = checkDate.toISOString().split('T')[0];
          if (isDateOccupied(checkDateStr, allRanges)) {
            isWeekFree = false;
            break;
          }
        }
        
        if (isWeekFree) {
          return { start: weekStartStr, end: weekEndStr };
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Fallback to next week from today
    const nextMonday = getNextMonday();
    const nextSunday = getNextSunday();
    return { start: nextMonday, end: nextSunday };
  };

  // Check if a specific date is occupied
  const isDateOccupied = (dateStr: string, ranges: Array<{ start: string; end: string; title: string }>) => {
    return ranges.some(range => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      const date = new Date(dateStr);
      return date >= start && date <= end;
    });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const getOverlapWarning = () => {
    const allRanges = [...existingRanges, ...occupiedData.occupiedRanges];
    if (hasOverlap(startDate, endDate, allRanges)) {
      const overlapping = allRanges.find(range => 
        hasOverlap(startDate, endDate, range.start, range.end)
      );
      return overlapping ? `Overlaps with "${overlapping.title}"` : 'Overlaps with existing plan';
    }
    return null;
  };

  const getDateRangeLength = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getProcessingTimeWarning = () => {
    const days = getDateRangeLength();
    if (days > 7) {
      return `⚠️ This plan covers ${days} days and may take longer to process.`;
    }
    return null;
  };

  const getMaxDateWarning = () => {
    const days = getDateRangeLength();
    if (days > 30) {
      return `❌ Maximum 30 days allowed. Current selection: ${days} days.`;
    }
    return null;
  };

  const getModeValidationWarning = () => {
    if (!startDate || !endDate) return null;
    
    const days = getDateRangeLength();
    
    if (selectionMode === 'single' && days !== 1) {
      return `⚠️ Single day mode selected but you've chosen ${days} days. Please select the same start and end date for a single day plan.`;
    }
    
    if (selectionMode === 'week' && days !== 7) {
      return `⚠️ Full week mode selected but you've chosen ${days} days. Please select exactly 7 consecutive days for a weekly plan.`;
    }
    
    return null;
  };

  const getOccupiedDatesInRange = () => {
    if (!startDate || !endDate) return [];
    
    const allRanges = [...existingRanges, ...occupiedData.occupiedRanges];
    const occupiedDatesInSelection = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (isDateOccupied(dateStr, allRanges)) {
        const overlappingPlan = allRanges.find(range => isDateOccupied(dateStr, [range]));
        occupiedDatesInSelection.push({
          date: dateStr,
          planTitle: overlappingPlan?.title || 'Unknown plan'
        });
      }
    }
    
    return occupiedDatesInSelection;
  };

  const getOccupiedDatesWarning = () => {
    const occupiedDates = getOccupiedDatesInRange();
    if (occupiedDates.length === 0) return null;
    
    const datesList = occupiedDates.map(d => `${formatSingleDate(d.date)} (${d.planTitle})`).join(', ');
    return `❌ The following dates already have meal plans: ${datesList}. Please choose different dates.`;
  };

  const formatSingleDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`date-range-picker ${className}`}>
      <div className="date-range-header">
        <label className="date-range-label">
          {label}
          <span className="required-asterisk">*</span>
        </label>
        {hint && <span className="date-range-hint">{hint}</span>}
      </div>

      <div className="date-selection-options">
        <div className="selection-mode-buttons">
          <button
            type="button"
            className={`mode-button ${selectionMode === 'single' ? 'active' : ''}`}
            onClick={() => {
              onSelectionModeChange?.('single');
              const freeDate = getFirstFreeDate();
              onChange(freeDate, freeDate);
            }}
          >
            <Calendar size={16} />
            <span>Single Day</span>
            <small>First free day</small>
          </button>
          
          <button
            type="button"
            className={`mode-button ${selectionMode === 'week' ? 'active' : ''}`}
            onClick={() => {
              onSelectionModeChange?.('week');
              const freeWeek = getNextFreeWeek();
              onChange(freeWeek.start, freeWeek.end);
            }}
          >
            <Calendar size={16} />
            <span>Full Week</span>
            <small>Next free week</small>
          </button>
          
           <button
             type="button"
             className={`mode-button ${selectionMode === 'custom' ? 'active' : ''}`}
             onClick={() => {
               onSelectionModeChange?.('custom');
               // For custom, set start date to first free date, let user pick end date
               const freeDate = getFirstFreeDate();
               onChange(freeDate, freeDate);
             }}
           >
             <Calendar size={16} />
             <span>Custom Range</span>
             <small>Choose your dates</small>
           </button>
        </div>

         <div className="date-input-group">
           <div className="date-input-wrapper">
             <EnhancedInput
               type="date"
               value={startDate}
               onChange={(e) => onChange(e.target.value, endDate)}
               icon={<Calendar size={16} />}
               placeholder="Start date"
               size="md"
               animated
               min={new Date().toISOString().split('T')[0]}
               max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
             />
             {selectionMode !== 'custom' && (
               <div className={`mode-indicator ${selectionMode}`}>
                 {selectionMode === 'single' ? 'Single Day Mode' : 'Full Week Mode'}
               </div>
             )}
           </div>
           <span className="date-separator">to</span>
           <div className="date-input-wrapper">
             <EnhancedInput
               type="date"
               value={endDate}
               onChange={(e) => onChange(startDate, e.target.value)}
               icon={<Calendar size={16} />}
               placeholder="End date"
               size="md"
               animated
               min={startDate || new Date().toISOString().split('T')[0]}
               max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
             />
             {selectionMode === 'custom' && (
               <div className="mode-indicator custom">Custom Range Mode</div>
             )}
           </div>
         </div>
      </div>


      {(error || getOverlapWarning() || getMaxDateWarning() || getProcessingTimeWarning() || getModeValidationWarning() || getOccupiedDatesWarning()) && (
        <div className="date-range-messages">
          {error && <div className="error-message">{error}</div>}
          {getOccupiedDatesWarning() && <div className="error-message">{getOccupiedDatesWarning()}</div>}
          {getOverlapWarning() && <div className="warning-message">{getOverlapWarning()}</div>}
          {getMaxDateWarning() && <div className="error-message">{getMaxDateWarning()}</div>}
          {getModeValidationWarning() && <div className="warning-message">{getModeValidationWarning()}</div>}
          {getProcessingTimeWarning() && <div className="info-message">{getProcessingTimeWarning()}</div>}
        </div>
      )}

      <style jsx>{`
        .date-range-picker {
          width: 100%;
          position: relative;
        }

        .date-range-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-2);
        }

        .date-range-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .required-asterisk {
          color: var(--danger);
          margin-left: 2px;
        }

        .date-range-hint {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .date-selection-options {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .selection-mode-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--space-3);
        }

        .mode-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-4);
          background-color: var(--panel-2);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }

        .mode-button:hover {
          border-color: var(--brand-300);
          background-color: var(--hover-bg);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .mode-button.active {
          border-color: var(--brand-500);
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          box-shadow: 0 4px 12px rgba(0, 177, 64, 0.2);
        }

        .mode-button span {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .mode-button small {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .date-range-inputs {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

         .date-input-group {
           display: flex;
           align-items: flex-start;
           gap: var(--space-3);
         }

         .date-input-wrapper {
           display: flex;
           flex-direction: column;
           gap: var(--space-2);
           flex: 1;
         }

         .mode-indicator {
           font-size: var(--text-xs);
           font-weight: var(--font-medium);
           padding: var(--space-1) var(--space-2);
           border-radius: var(--radius-sm);
           text-align: center;
           transition: all var(--transition-fast);
         }

         .mode-indicator.single {
           color: var(--brand-600);
           background-color: var(--brand-50);
           border: 1px solid var(--brand-200);
         }

         .mode-indicator.week {
           color: var(--brand-600);
           background-color: var(--brand-50);
           border: 1px solid var(--brand-200);
         }

         .mode-indicator.custom {
           color: var(--brand-600);
           background-color: var(--brand-50);
           border: 1px solid var(--brand-200);
         }

        .date-separator {
          color: var(--text-muted);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          white-space: nowrap;
        }

        .suggestions-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background-color: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-size: var(--text-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
          align-self: flex-start;
        }

        .suggestions-toggle:hover {
          background-color: var(--hover-bg);
          border-color: var(--brand-300);
          color: var(--text);
        }

        .suggestions-panel {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: var(--space-2);
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-dropdown);
          overflow: hidden;
        }

        .suggestions-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
          background-color: var(--panel-2);
        }

        .suggestions-header h4 {
          margin: 0 0 var(--space-1) 0;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .suggestions-header p {
          margin: 0;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .suggestions-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: var(--space-3) var(--space-4);
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background-color var(--transition-fast);
          border-bottom: 1px solid var(--border);
        }

        .suggestion-item:last-child {
          border-bottom: none;
        }

        .suggestion-item:hover:not(.unavailable) {
          background-color: var(--hover-bg);
        }

        .suggestion-item.unavailable {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .suggestion-content {
          flex: 1;
        }

        .suggestion-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
          margin-bottom: var(--space-1);
        }

        .suggestion-dates {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-bottom: var(--space-1);
        }

        .suggestion-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .unavailable-indicator {
          color: var(--warning);
        }

        .date-range-messages {
          margin-top: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .error-message {
          color: var(--danger);
          font-weight: var(--font-medium);
          font-size: var(--text-xs);
          padding: var(--space-2);
          background-color: var(--danger-50);
          border: 1px solid var(--danger-200);
          border-radius: var(--radius-md);
        }

        .warning-message {
          color: var(--warning);
          font-weight: var(--font-medium);
          font-size: var(--text-xs);
          padding: var(--space-2);
          background-color: var(--warning-50);
          border: 1px solid var(--warning-200);
          border-radius: var(--radius-md);
        }

        .info-message {
          color: var(--info);
          font-weight: var(--font-medium);
          font-size: var(--text-xs);
          padding: var(--space-2);
          background-color: var(--info-50);
          border: 1px solid var(--info-200);
          border-radius: var(--radius-md);
        }

         /* Dark theme mode indicators */
         [data-theme="dark"] .mode-indicator.single,
         [data-theme="dark"] .mode-indicator.week,
         [data-theme="dark"] .mode-indicator.custom {
           color: var(--brand-400);
           background-color: rgba(0, 177, 64, 0.1);
           border: 1px solid rgba(0, 177, 64, 0.3);
         }

         @media (max-width: 640px) {
           .date-input-group {
             flex-direction: column;
             align-items: stretch;
           }

           .date-separator {
             text-align: center;
             padding: var(--space-2) 0;
           }

           .selection-mode-buttons {
             grid-template-columns: 1fr;
           }
         }
      `}</style>
    </div>
  );
}

// Helper functions
function getNextMonday(): string {
  const today = new Date();
  const monday = new Date(today);
  const daysUntilMonday = (1 + 7 - today.getDay()) % 7;
  monday.setDate(today.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
  return monday.toISOString().split('T')[0];
}

function getNextSunday(): string {
  const monday = new Date(getNextMonday());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday.toISOString().split('T')[0];
}

function getThisMonday(): string {
  const today = new Date();
  const monday = new Date(today);
  const daysSinceMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
  monday.setDate(today.getDate() - daysSinceMonday);
  return monday.toISOString().split('T')[0];
}

function getThisSunday(): string {
  const monday = new Date(getThisMonday());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday.toISOString().split('T')[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function hasOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  return s1 <= e2 && s2 <= e1;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
