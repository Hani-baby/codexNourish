"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Persona = {
  tone?: string
  style?: string
  dietary_focus?: string
  kitchen_equipment?: string[]
  allergies?: string[]
  cuisines?: string[]
  dislikes?: string[]
  skill_level?: string
  household_size?: number
}

export default function AIPersonaAdmin() {
  const [persona, setPersona] = useState<Persona>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not authenticated'); return }
        const { data, error } = await supabase.from('user_settings').select('ai_persona').eq('user_id', user.id).maybeSingle()
        if (error) throw error
        if (data?.ai_persona) {
          const p = typeof data.ai_persona === 'string' ? JSON.parse(data.ai_persona) : data.ai_persona
          setPersona(p || {})
        }
      } catch (e:any) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const updateField = (key: keyof Persona, value: any) => setPersona(prev => ({ ...prev, [key]: value }))
  const parseList = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

  const save = async () => {
    try {
      setSaving(true); setError(null); setOk(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); return }
      const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ai_persona: persona }, { onConflict: 'user_id' })
      if (error) throw error
      setOk('Saved! Persona will be used in chat and planning.')
    } catch (e:any) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
      <h1>AI Persona</h1>
      <p>Configure Chef Nourish tone and user customizations. Lists are comma-separated.</p>
      {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
      {ok && <div style={{ color: 'seagreen', marginTop: 8 }}>{ok}</div>}

      <div className="form-grid">
        <label> Tone <input value={persona.tone || ''} onChange={e => updateField('tone', e.target.value)} /></label>
        <label> Style <input value={persona.style || ''} onChange={e => updateField('style', e.target.value)} /></label>
        <label> Dietary focus <input value={persona.dietary_focus || ''} onChange={e => updateField('dietary_focus', e.target.value)} /></label>
        <label> Kitchen equipment <input value={(persona.kitchen_equipment || []).join(', ')} onChange={e => updateField('kitchen_equipment', parseList(e.target.value))} /></label>
        <label> Allergies <input value={(persona.allergies || []).join(', ')} onChange={e => updateField('allergies', parseList(e.target.value))} /></label>
        <label> Preferred cuisines <input value={(persona.cuisines || []).join(', ')} onChange={e => updateField('cuisines', parseList(e.target.value))} /></label>
        <label> Dislikes <input value={(persona.dislikes || []).join(', ')} onChange={e => updateField('dislikes', parseList(e.target.value))} /></label>
        <label> Skill level
          <select value={persona.skill_level || ''} onChange={e => updateField('skill_level', e.target.value)}>
            <option value="">(unspecified)</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label> Household size <input type="number" value={persona.household_size || 0} onChange={e => updateField('household_size', Number(e.target.value))} /></label>
      </div>

      <button disabled={saving} onClick={save} style={{ marginTop: 12 }}>{saving ? 'Saving…' : 'Save persona'}</button>

      <style jsx>{`
        h1 { margin-bottom: 8px; }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        label { display: flex; flex-direction: column; gap: 4px; }
        input, select { padding: 8px; border: 1px solid var(--border); border-radius: 6px; }
        button { padding: 8px 12px; border-radius: 6px; background: var(--brand); color: #fff; border: none; }
        button[disabled] { opacity: .7 }
      `}</style>
    </div>
  )
}

