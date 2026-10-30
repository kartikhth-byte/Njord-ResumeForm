import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Save, Settings2 } from 'lucide-react'
import {
  getAdminRuntimeSettings,
  SETTINGS_SECTIONS,
  updateAdminRuntimeSettings,
} from '../../services/runtimeSettingsService'

const SECTION_ORDER = ['microsoft', 'email', 'ai', 'app']

function SecretField({ fieldKey, label, configured, value, onChange }) {
  const [showValue, setShowValue] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={fieldKey} className="text-sm font-medium text-fg">
          {label}
        </label>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
 configured ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
 }`}>
          {configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
          {configured ? 'Configured' : 'Missing'}
        </span>
      </div>
      <div className="relative">
        <input
          id={fieldKey}
          type={showValue ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(fieldKey, event.target.value)}
          placeholder={configured ? 'Saved (masked) — enter a value to replace' : 'Not configured'}
          className="w-full rounded-control border border-line bg-surface px-4 py-3 pr-12 text-sm text-fg outline-none transition focus:border-fg"
        />
        <button
          type="button"
          onClick={() => setShowValue(current => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-fg-muted transition hover:bg-raised hover:text-fg"
          aria-label={showValue ? 'Hide value' : 'Show value'}
        >
          {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function PlainField({ fieldKey, label, value, onChange, type = 'text' }) {
  return (
    <div className="space-y-2">
      <label htmlFor={fieldKey} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={fieldKey}
        type={type}
        value={value}
        onChange={(event) => onChange(fieldKey, event.target.value)}
        className="w-full rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg outline-none transition focus:border-fg"
      />
    </div>
  )
}

export default function RecruiterIntegrationsSection() {
  const [loading, setLoading] = useState(true)
  const [savingSection, setSavingSection] = useState(null)
  const [settings, setSettings] = useState([])
  const [formValues, setFormValues] = useState({})
  const [statusBySection, setStatusBySection] = useState({})

  useEffect(() => {
    let mounted = true

    const loadSettings = async () => {
      try {
        const loadedSettings = await getAdminRuntimeSettings()
        if (!mounted) return

        setSettings(loadedSettings)
        setFormValues(
          loadedSettings.reduce((accumulator, setting) => {
            accumulator[setting.key] = setting.value || ''
            return accumulator
          }, {})
        )
      } catch (error) {
        if (!mounted) return
        setStatusBySection({
          global: {
            type: 'error',
            message: error.message || 'Failed to load integration settings.',
          },
        })
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadSettings()

    return () => {
      mounted = false
    }
  }, [])

  const settingsBySection = useMemo(() => {
    return SECTION_ORDER.reduce((accumulator, sectionKey) => {
      accumulator[sectionKey] = settings.filter(setting => setting.section === sectionKey)
      return accumulator
    }, {})
  }, [settings])

  const handleFieldChange = (fieldKey, value) => {
    setFormValues(current => ({
      ...current,
      [fieldKey]: value,
    }))
  }

  const handleSaveSection = async (sectionKey) => {
    const sectionSettings = settingsBySection[sectionKey] || []
    if (sectionSettings.length === 0) return

    const payload = {}
    sectionSettings.forEach(setting => {
      const nextValue = formValues[setting.key] ?? ''
      if (!setting.isSecret || nextValue.trim()) {
        payload[setting.key] = nextValue
      }
    })

    setSavingSection(sectionKey)
    setStatusBySection(current => ({
      ...current,
      [sectionKey]: null,
    }))

    try {
      await updateAdminRuntimeSettings(payload)
      const refreshedSettings = await getAdminRuntimeSettings()
      setSettings(refreshedSettings)
      setFormValues(current => ({
        ...current,
        ...refreshedSettings.reduce((accumulator, setting) => {
          if (!setting.isSecret) {
            accumulator[setting.key] = setting.value || ''
          } else {
            accumulator[setting.key] = ''
          }
          return accumulator
        }, {}),
      }))
      setStatusBySection(current => ({
        ...current,
        [sectionKey]: {
          type: 'success',
          message: 'Settings saved successfully.',
        },
      }))
    } catch (error) {
      setStatusBySection(current => ({
        ...current,
        [sectionKey]: {
          type: 'error',
          message: error.message || 'Failed to save settings.',
        },
      }))
    } finally {
      setSavingSection(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-fg-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading integration settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="mt-3 text-3xl font-semibold text-fg">Integrations &amp; Secrets</h2>
        </div>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-card bg-accent-fill text-on-accent">
          <Settings2 className="h-5 w-5" />
        </span>
      </div>

      {statusBySection.global ? (
        <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {statusBySection.global.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {SECTION_ORDER.map(sectionKey => {
          const sectionSettings = settingsBySection[sectionKey] || []
          if (sectionSettings.length === 0) return null

          const status = statusBySection[sectionKey]

          return (
            <section key={sectionKey} className="rounded-[28px] border border-line bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="mt-2 text-xl font-semibold text-fg">{SETTINGS_SECTIONS[sectionKey]}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveSection(sectionKey)}
                  disabled={savingSection === sectionKey}
                  className="inline-flex items-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover disabled:cursor-not-allowed disabled:bg-fg-muted"
                >
                  {savingSection === sectionKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {sectionSettings.map(setting => {
                  const value = formValues[setting.key] ?? ''
                  const inputType = setting.key.includes('URI') || setting.key.includes('URL') ? 'url' : 'text'

                  return setting.isSecret ? (
                    <SecretField
                      key={setting.key}
                      fieldKey={setting.key}
                      label={setting.label}
                      configured={setting.configured}
                      value={value}
                      onChange={handleFieldChange}
                    />
                  ) : (
                    <PlainField
                      key={setting.key}
                      fieldKey={setting.key}
                      label={setting.label}
                      value={value}
                      onChange={handleFieldChange}
                      type={inputType}
                    />
                  )
                })}
              </div>

              {status ? (
                <div className={`mt-5 rounded-control px-4 py-3 text-sm ${
 status.type === 'success'
 ? 'border border-success-line bg-success-soft text-success'
 : 'border border-danger-line bg-danger-soft text-danger'
 }`}>
                  {status.message}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
