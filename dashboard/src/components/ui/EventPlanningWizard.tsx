import React, { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
import Button from './Button'
import EnhancedInput from './EnhancedInput'
import DateRangePicker from './DateRangePicker'
import StepIndicator from './StepIndicator'
import { Calendar, Users, Clock, Sparkles, AlertTriangle, X, ChefHat, Target, Zap, PartyPopper } from 'lucide-react'
import { getOccupiedDates } from '../../lib/data-services'
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2'

interface EventPlanningWizardProps {
  isOpen: boolean
  onClose: () => void
  onCreateEvent: (eventData: EventData) => void
}

interface EventData {
  dateRange: {
    start: string
    end: string
  }
  eventDetails: {
    isEvent: true
    guestCount: number
    eventDescription: string
    eventMeals: 'breakfast' | 'lunch' | 'dinner' | 'all-day'
  }
  inspiration: string
  usePreferences: boolean
  specificRequests: string
  include_ai_text?: boolean
  refresh_grocery_list?: boolean
}

export default function EventPlanningWizard({ isOpen, onClose, onCreateEvent }: EventPlanningWizardProps) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<EventData>({
    dateRange: {
      start: getNextAvailableDate(),
      end: getNextAvailableDate()
    },
    eventDetails: {
      isEvent: true,
      guestCount: 10,
      eventDescription: '',
      eventMeals: 'dinner'
    },
    inspiration: '',
    usePreferences: true,
    specificRequests: ''
  })
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [occupiedData, setOccupiedData] = useState<{
    occupiedDates: string[];
    occupiedRanges: Array<{ start: string; end: string; title: string }>;
  }>({ occupiedDates: [], occupiedRanges: [] })

  // Fetch occupied dates
  React.useEffect(() => {
    const fetchOccupiedDates = async () => {
      if (!user?.id) return;
      
      const { data, error } = await getOccupiedDates(user.id);
      
      if (error) {
        console.error('Failed to fetch occupied dates:', error);
      } else {
        setOccupiedData(data);
      }
    };

    fetchOccupiedDates();
  }, [user?.id]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      if (!formData.usePreferences && formData.specificRequests.trim()) {
        setShowConfirmation(true)
      } else {
        handleCreateEvent()
      }
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleCreateEvent = () => {
    onCreateEvent(formData)
    onClose()
  }

  const updateFormData = (updates: Partial<EventData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  if (!isOpen) return null

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        {showConfirmation ? (
          <Card className="confirmation-card">
            <CardHeader>
              <div className="confirmation-header">
                <AlertTriangle size={24} className="warning-icon" />
                <CardTitle>Confirm Your Event Plan</CardTitle>
              </div>
              <CardDescription>
                You've chosen to ignore your dietary preferences for this event. 
                This may result in meal suggestions that don't align with your usual preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="confirmation-details">
                {!formData.usePreferences && (
                  <div className="warning-item">
                    <strong>Dietary preferences will be ignored</strong>
                    <p>The event meal plan won't consider your saved dietary restrictions and preferences.</p>
                  </div>
                )}
                {!formData.usePreferences && formData.specificRequests.trim() && (
                  <div className="warning-item">
                    <strong>Your specific requests:</strong>
                    <p>"{formData.specificRequests}"</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <div className="confirmation-actions">
                <Button variant="ghost" onClick={() => setShowConfirmation(false)}>
                  Go Back
                </Button>
                <Button onClick={handleCreateEvent}>
                  Yes, Create Event Plan
                </Button>
              </div>
            </CardFooter>
          </Card>
        ) : (
          <Card className="wizard-card">
            <CardHeader>
              <div className="wizard-header">
                <div className="wizard-title-section">
                  <div className="wizard-icon">
                    <PartyPopper size={24} />
                  </div>
                  <div>
                    <CardTitle>Plan Your Special Event</CardTitle>
                    <CardDescription>Let's create an amazing meal plan for your gathering</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="close-button">
                  <X size={16} />
                </Button>
              </div>
              <StepIndicator
                currentStep={step}
                totalSteps={3}
                steps={[
                  { title: 'Event Details', description: 'When and what type of event' },
                  { title: 'Guest Count', description: 'How many people to plan for' },
                  { title: 'Preferences', description: 'Finalize your event plan' }
                ]}
              />
            </CardHeader>

            <CardContent>
              {step === 1 && (
                <div className="wizard-step">
                  <div className="step-header">
                    <div className="step-icon">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3>Event Details</h3>
                      <p>Tell us about your special event</p>
                    </div>
                  </div>

                  <div className="form-section">
                    <DateRangePicker
                      startDate={formData.dateRange.start}
                      endDate={formData.dateRange.end}
                      onChange={(start, end) => updateFormData({
                        dateRange: { start, end }
                      })}
                      existingRanges={occupiedData.occupiedRanges}
                      label="Event Date"
                      hint="Choose the date for your special event"
                    />
                  </div>

                  <div className="form-section">
                    <label className="section-label">What type of event is this?</label>
                    <div className="event-type-options">
                      <button
                        type="button"
                        className={`event-type-option ${formData.eventDetails.eventMeals === 'breakfast' ? 'active' : ''}`}
                        onClick={() => updateFormData({
                          eventDetails: {
                            ...formData.eventDetails,
                            eventMeals: 'breakfast'
                          }
                        })}
                      >
                        <div className="event-type-icon">🌅</div>
                        <div className="event-type-content">
                          <div className="event-type-title">Breakfast Event</div>
                          <div className="event-type-description">Morning gathering, brunch, or breakfast meeting</div>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        className={`event-type-option ${formData.eventDetails.eventMeals === 'lunch' ? 'active' : ''}`}
                        onClick={() => updateFormData({
                          eventDetails: {
                            ...formData.eventDetails,
                            eventMeals: 'lunch'
                          }
                        })}
                      >
                        <div className="event-type-icon">☀️</div>
                        <div className="event-type-content">
                          <div className="event-type-title">Lunch Event</div>
                          <div className="event-type-description">Midday celebration or lunch gathering</div>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        className={`event-type-option ${formData.eventDetails.eventMeals === 'dinner' ? 'active' : ''}`}
                        onClick={() => updateFormData({
                          eventDetails: {
                            ...formData.eventDetails,
                            eventMeals: 'dinner'
                          }
                        })}
                      >
                        <div className="event-type-icon">🌙</div>
                        <div className="event-type-content">
                          <div className="event-type-title">Dinner Event</div>
                          <div className="event-type-description">Evening celebration or dinner party</div>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        className={`event-type-option ${formData.eventDetails.eventMeals === 'all-day' ? 'active' : ''}`}
                        onClick={() => updateFormData({
                          eventDetails: {
                            ...formData.eventDetails,
                            eventMeals: 'all-day'
                          }
                        })}
                      >
                        <div className="event-type-icon">🎉</div>
                        <div className="event-type-content">
                          <div className="event-type-title">All Day Event</div>
                          <div className="event-type-description">Full day celebration with multiple meals</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="form-section">
                    <EnhancedInput
                      label="Tell us about your event"
                      placeholder="e.g., Family reunion, birthday party, holiday celebration, corporate event..."
                      value={formData.inspiration}
                      onChange={(e) => updateFormData({ inspiration: e.target.value })}
                      icon={<Sparkles size={16} />}
                      hint="Describe your event theme, special requirements, or any specific requests"
                      animated
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="wizard-step">
                  <div className="step-header">
                    <div className="step-icon">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3>Guest Count</h3>
                      <p>How many people are you planning for?</p>
                    </div>
                  </div>

                  <div className="form-section">
                    <EnhancedInput
                      label="Number of guests (including yourself)"
                      type="number"
                      value={formData.eventDetails.guestCount.toString()}
                      onChange={(e) => updateFormData({
                        eventDetails: {
                          ...formData.eventDetails,
                          guestCount: parseInt(e.target.value) || 1
                        }
                      })}
                      icon={<Users size={16} />}
                      hint="Include yourself in the count"
                      animated
                    />
                  </div>

                  <div className="form-section">
                    <label className="section-label">Quick guest count options</label>
                    <div className="guest-count-grid">
                      {[5, 10, 15, 20, 25, 30, 50, 100].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`guest-count-option ${formData.eventDetails.guestCount === count ? 'active' : ''}`}
                          onClick={() => updateFormData({
                            eventDetails: {
                              ...formData.eventDetails,
                              guestCount: count
                            }
                          })}
                        >
                          <div className="guest-count-number">{count}</div>
                          <div className="guest-count-label">
                            {count <= 10 ? 'Small gathering' :
                             count <= 20 ? 'Medium event' :
                             count <= 50 ? 'Large celebration' :
                             'Major event'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="wizard-step">
                  <div className="step-header">
                    <div className="step-icon">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h3>Preferences & Special Requests</h3>
                      <p>Fine-tune your event meal plan</p>
                    </div>
                  </div>
                  
                  <div className="form-section">
                    <div className="preference-toggle">
                      <div className="toggle-header">
                        <div className="toggle-icon">
                          <Target size={18} />
                        </div>
                        <div className="toggle-content">
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={formData.usePreferences}
                              onChange={(e) => updateFormData({ usePreferences: e.target.checked })}
                            />
                            <span className="toggle-text">
                              Use my dietary preferences and restrictions
                            </span>
                          </label>
                          <p className="toggle-description">
                            We'll create meals tailored to your saved preferences and dietary restrictions
                          </p>
                        </div>
                      </div>
                    </div>

                    {!formData.usePreferences && (
                      <div className="form-section">
                        <EnhancedInput
                          label="Tell us what you want for this event"
                          placeholder="e.g., Mediterranean theme, avoid dairy, include vegetarian options, focus on comfort foods..."
                          value={formData.specificRequests}
                          onChange={(e) => updateFormData({ specificRequests: e.target.value })}
                          icon={<Sparkles size={16} />}
                          hint="Since you're not using saved preferences, help us understand what you want for this event"
                          animated
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-section">
                    <div className="feature-toggles">
                      <div className="feature-toggle">
                        <label className="toggle-label">
                          <input 
                            type="checkbox" 
                            checked={formData.include_ai_text ?? true} 
                            onChange={(e) => updateFormData({ include_ai_text: e.target.checked })} 
                          />
                          <span className="toggle-text">Polish event plan with AI</span>
                        </label>
                        <p className="toggle-description">Make your event meal plan descriptions more engaging</p>
                      </div>
                      <div className="feature-toggle">
                        <label className="toggle-label">
                          <input 
                            type="checkbox" 
                            checked={formData.refresh_grocery_list ?? true} 
                            onChange={(e) => updateFormData({ refresh_grocery_list: e.target.checked })} 
                          />
                          <span className="toggle-text">Auto-generate shopping list</span>
                        </label>
                        <p className="toggle-description">Create a shopping list based on your event meal plan</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter>
              <div className="wizard-actions">
                <Button 
                  variant="ghost" 
                  onClick={handleBack}
                  disabled={step === 1}
                >
                  Back
                </Button>
                <Button onClick={handleNext}>
                  {step === 3 ? 'Create Event Plan' : 'Next'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>

      <style jsx>{`
        .wizard-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6));
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-modal);
          padding: var(--space-4);
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .wizard-container {
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .wizard-card, .confirmation-card {
          background-color: var(--panel);
          box-shadow: var(--shadow-xl);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .wizard-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: var(--space-6);
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, var(--panel), var(--panel-2));
        }

        .wizard-title-section {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .wizard-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, #FF6B6B, #FF8E8E);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
        }

        .close-button {
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
        }

        .close-button:hover {
          background-color: var(--hover-bg);
          transform: scale(1.05);
        }

        .confirmation-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .warning-icon {
          color: var(--warning);
        }

        .wizard-step {
          padding: var(--space-6);
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .step-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--brand-100), var(--brand-200));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-600);
        }

        .step-header h3 {
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
        }

        .step-header p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .form-section {
          margin-bottom: var(--space-6);
        }

        .section-label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin-bottom: var(--space-3);
        }

        .event-type-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-3);
          margin-top: var(--space-3);
        }

        .event-type-option {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          background-color: var(--panel-2);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .event-type-option:hover {
          border-color: var(--brand-300);
          background-color: var(--hover-bg);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .event-type-option.active {
          border-color: var(--brand-500);
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          box-shadow: 0 4px 12px rgba(0, 177, 64, 0.2);
        }

        .event-type-icon {
          font-size: var(--text-xl);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .event-type-content {
          flex: 1;
        }

        .event-type-title {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin-bottom: var(--space-1);
        }

        .event-type-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .guest-count-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: var(--space-3);
          margin-top: var(--space-3);
        }

        .guest-count-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-3);
          background-color: var(--panel-2);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }

        .guest-count-option:hover {
          border-color: var(--brand-300);
          background-color: var(--hover-bg);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .guest-count-option.active {
          border-color: var(--brand-500);
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          box-shadow: 0 4px 12px rgba(0, 177, 64, 0.2);
        }

        .guest-count-number {
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
          color: var(--brand-600);
          margin-bottom: var(--space-1);
        }

        .guest-count-option.active .guest-count-number {
          color: var(--brand-700);
        }

        .guest-count-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-weight: var(--font-medium);
        }

        .preference-toggle {
          background: linear-gradient(135deg, var(--panel-2), var(--panel));
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .toggle-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
        }

        .toggle-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-lg);
          background-color: var(--brand-100);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-600);
          flex-shrink: 0;
        }

        .toggle-content {
          flex: 1;
        }

        .toggle-label {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          cursor: pointer;
          margin-bottom: var(--space-2);
        }

        .toggle-label input[type="checkbox"] {
          margin: 0;
          margin-top: 2px;
          width: 18px;
          height: 18px;
          accent-color: var(--brand-500);
        }

        .toggle-text {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .toggle-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }

        .feature-toggles {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .feature-toggle {
          background: linear-gradient(135deg, var(--panel-2), var(--panel));
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
        }

        .wizard-actions {
          display: flex;
          justify-content: space-between;
          width: 100%;
          padding: var(--space-6);
          border-top: 1px solid var(--border);
          background: linear-gradient(135deg, var(--panel), var(--panel-2));
        }

        .confirmation-details {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .warning-item {
          padding: var(--space-4);
          background: linear-gradient(135deg, var(--warning-100), var(--warning-50));
          border: 1px solid var(--warning-200);
          border-radius: var(--radius-lg);
        }

        [data-theme="dark"] .warning-item {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05));
          border-color: rgba(251, 191, 36, 0.2);
        }

        .warning-item strong {
          display: block;
          color: var(--warning-700);
          margin-bottom: var(--space-1);
          font-weight: var(--font-semibold);
        }

        [data-theme="dark"] .warning-item strong {
          color: var(--warning-300);
        }

        .warning-item p {
          margin: 0;
          color: var(--warning-600);
          font-size: var(--text-sm);
          line-height: 1.4;
        }

        [data-theme="dark"] .warning-item p {
          color: var(--warning-200);
        }

        .confirmation-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
          width: 100%;
        }

        @media (max-width: 640px) {
          .wizard-overlay {
            padding: var(--space-2);
          }

          .wizard-container {
            max-width: 100%;
          }

          .wizard-header {
            padding: var(--space-4);
          }

          .wizard-step {
            padding: var(--space-4);
          }

          .event-type-options {
            grid-template-columns: 1fr;
          }

          .guest-count-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

// Helper functions
function getNextAvailableDate(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}
