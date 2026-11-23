import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { ProgressBar } from './components/progress-bar'
import { QuestionCard, type AnswerOption } from './components/question-card'
import { supabase } from './lib/supabase'
import { sendLeadToN8n, type N8nLeadPayload } from './lib/n8n-lead-webhook'

type Answers = {
  age?: string
  employment?: string
  condition?: string
  workImpact?: string
  benefits?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  state?: string
}

const questionSteps: { key: keyof Answers; eyebrow: string; question: string; description: string; options: AnswerOption[] }[] = [
  { key: 'age', eyebrow: 'A quick starting point', question: 'Are you 40 years of age or older?', description: 'This helps us understand which information may be relevant to you.', options: [{ label: 'Yes', detail: 'I am 40 or older', icon: '✓' }, { label: 'No', detail: 'I am under 40', icon: '→' }] },
  { key: 'employment', eyebrow: 'Your work situation', question: 'Which best describes your current work status?', description: 'There is no right or wrong answer. Choose the closest fit.', options: [{ label: 'Working full time', detail: 'Currently employed 30+ hours a week' }, { label: 'Working part time', detail: 'Currently employed less than 30 hours a week' }, { label: 'Not working', detail: 'Not currently employed' }, { label: 'On leave', detail: 'Temporarily away from work' }] },
  { key: 'condition', eyebrow: 'Your health', question: 'Has a health condition affected your ability to work?', description: 'For example, a physical or mental health condition that makes working difficult.', options: [{ label: 'Yes, significantly', detail: 'It limits the kind or amount of work I can do' }, { label: 'Yes, somewhat', detail: 'It affects my work, but I can still work' }, { label: 'Not currently', detail: 'My health has not affected my work' }] },
  { key: 'workImpact', eyebrow: 'A little more context', question: 'Have you had to reduce or stop working because of your health?', description: 'Select the answer that best reflects your recent experience.', options: [{ label: 'Yes, I stopped working', detail: 'My health led me to stop working' }, { label: 'Yes, I reduced my hours', detail: 'I work less than I used to' }, { label: 'No', detail: 'I have not reduced or stopped work' }] },
  { key: 'benefits', eyebrow: 'Next steps', question: 'Are you currently receiving disability benefits?', description: 'This is a preliminary information check, not an official determination.', options: [{ label: 'Yes', detail: 'I currently receive disability benefits' }, { label: 'No', detail: 'I do not currently receive benefits' }, { label: 'I am not sure', detail: 'I would like help understanding my options' }] },
]

const states = ['Select a state', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia']

export default function App() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'webhook-error'>('idle')
  const [submissionError, setSubmissionError] = useState('')
  const submissionLock = useRef(false)
  const submissionId = useRef<string | null>(null)
  const pendingWebhookPayload = useRef<N8nLeadPayload | null>(null)
  const supabaseLeadSaved = useRef(false)
  const totalSteps = 6
  const isQuestion = step >= 1 && step <= questionSteps.length
  const progressStep = Math.min(step, totalSteps)

  const update = (key: keyof Answers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  const selectAnswer = (key: keyof Answers, value: string) => {
    update(key, value)
    window.setTimeout(() => setStep((current) => current + 1), 220)
  }

  const validateContact = () => {
    const next: Record<string, string> = {}
    if (!answers.firstName?.trim()) next.firstName = 'Enter your first name.'
    if (!answers.lastName?.trim()) next.lastName = 'Enter your last name.'
    if (!answers.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) next.email = 'Enter a valid email address.'
    if (!answers.phone?.replace(/\D/g, '').match(/^\d{10,}$/)) next.phone = 'Enter a valid phone number.'
    if (!answers.state) next.state = 'Choose your state.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const continueContact = async () => {
    if (submissionLock.current || (!supabaseLeadSaved.current && !validateContact())) return

    submissionLock.current = true
    setSubmissionStatus('loading')
    setSubmissionError('')

    try {
      if (supabaseLeadSaved.current && pendingWebhookPayload.current) {
        const delivered = await sendLeadToN8n(pendingWebhookPayload.current)
        if (!delivered) {
          setSubmissionStatus('webhook-error')
          setSubmissionError('Your information is saved, but delivery to our follow-up system wasn’t confirmed. Retry to send this same submission.')
          submissionLock.current = false
          return
        }
      } else {
        const currentSubmissionId = submissionId.current ?? crypto.randomUUID()
        submissionId.current = currentSubmissionId
        const landingUrl = new URL(window.location.href)
        const utmData = Object.fromEntries(
          Array.from(landingUrl.searchParams.entries()).filter(([key]) => /^utm_[a-z0-9_]+$/i.test(key)),
        )
        const leadData = {
          submission_id: currentSubmissionId,
          first_name: answers.firstName?.trim() ?? '',
          last_name: answers.lastName?.trim() ?? '',
          email: answers.email?.trim() ?? '',
          phone: answers.phone?.trim() ?? '',
          state: answers.state ?? '',
          qualification_status: 'pending_review',
          answers: {
            age: answers.age ?? null,
            employment: answers.employment ?? null,
            condition: answers.condition ?? null,
            workImpact: answers.workImpact ?? null,
            benefits: answers.benefits ?? null,
          },
          utm_data: utmData,
          fbclid: landingUrl.searchParams.get('fbclid') || null,
          landing_page: `${landingUrl.origin}${landingUrl.pathname}`,
        }

        const { error } = await supabase.from('leads').insert(leadData)
        if (error) throw error

        supabaseLeadSaved.current = true
        pendingWebhookPayload.current = {
          ...leadData,
          campaign: typeof utmData.utm_campaign === 'string' ? utmData.utm_campaign : null,
          utm_parameters: utmData,
          submitted_at: new Date().toISOString(),
        }

        const delivered = await sendLeadToN8n(pendingWebhookPayload.current)
        if (!delivered) {
          setSubmissionStatus('webhook-error')
          setSubmissionError('Your information is saved, but delivery to our follow-up system wasn’t confirmed. Retry to send this same submission.')
          submissionLock.current = false
          return
        }
      }

      pendingWebhookPayload.current = null
      supabaseLeadSaved.current = false
      submissionId.current = null
      setSubmissionStatus('success')
      setStep(7)
    } catch (cause) {
      const errorInfo = cause && typeof cause === 'object'
        ? cause as { code?: unknown; status?: unknown; message?: unknown }
        : {}
      let safeMessage = typeof errorInfo.message === 'string' ? errorInfo.message : 'Unknown submission error'
      const sensitiveValues = [answers.firstName, answers.lastName, answers.email, answers.phone]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))

      for (const value of sensitiveValues) {
        safeMessage = safeMessage.split(value).join('[redacted]')
      }
      safeMessage = safeMessage
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
        .replace(/\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[redacted phone]')
        .slice(0, 500)

      console.error('[v0] Lead submission failed', {
        code: typeof errorInfo.code === 'string' ? errorInfo.code : null,
        status: typeof errorInfo.status === 'number' ? errorInfo.status : null,
        message: safeMessage,
      })
      submissionLock.current = false
      setSubmissionStatus('error')
      setSubmissionError('We couldn’t save your information. Please try again.')
    }
  }

  const resetSubmission = () => {
    submissionLock.current = false
    submissionId.current = null
    pendingWebhookPayload.current = null
    supabaseLeadSaved.current = false
    setSubmissionStatus('idle')
    setSubmissionError('')
  }

  const goBack = () => {
    if (pendingWebhookPayload.current) {
      setSubmissionError('Delivery is still pending. Retry before leaving this step.')
      return
    }
    setErrors({})
    setStep((current) => Math.max(0, current - 1))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); if (pendingWebhookPayload.current) { setSubmissionError('Delivery is still pending. Retry before leaving this step.'); return }; setStep(0); resetSubmission() }} aria-label="ClearPath home">
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.2} /></span>
          <span>clearpath<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-trust"><LockKeyhole size={14} /> Your information is private</div>
      </header>

      <main className="main-wrap">
        {step > 0 && step < 7 && <ProgressBar current={progressStep} total={totalSteps} />}
        <div className="journey" key={step}>
          {step === 0 && <section className="intro-screen">
            <div className="intro-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> PERSONALIZED BENEFITS GUIDANCE</div>
              <h1>Find a clearer path<br className="desktop-break" /> forward.</h1>
              <p className="intro-lead">A few simple questions can help you explore whether disability benefits information may be relevant to your situation.</p>
              <div className="intro-points">
                <div><span className="point-icon"><ShieldCheck size={18} /></span><span><strong>Private & secure</strong><small>Your answers stay confidential</small></span></div>
                <div><span className="point-icon"><CheckCircle2 size={18} /></span><span><strong>About 2 minutes</strong><small>Quick questions, clear next steps</small></span></div>
              </div>
              <button className="primary-button intro-cta" onClick={() => setStep(1)}>Get started <ArrowRight size={18} /></button>
              <p className="disclaimer">This free questionnaire is for informational purposes only and does not guarantee eligibility or benefits. ClearPath is not affiliated with or endorsed by the Social Security Administration.</p>
            </div>
            <div className="visual-panel" aria-hidden="true">
              <div className="sun-disc" />
              <div className="path-line path-one" /><div className="path-line path-two" />
              <div className="floating-card card-top"><span className="card-icon"><ShieldCheck size={17} /></span><span><strong>A more informed next step</strong><small>Guidance, at your pace</small></span></div>
              <div className="landscape"><div className="hill hill-back" /><div className="hill hill-front" /><div className="trail" /><div className="trail-dot dot-one" /><div className="trail-dot dot-two" /><div className="trail-dot dot-three" /><div className="trail-end"><Check size={16} /></div></div>
              <div className="floating-card card-bottom"><span className="mini-avatars"><i>J</i><i>M</i><i>A</i></span><span><strong>Support starts with clarity</strong><small>One question at a time</small></span></div>
              <div className="panel-caption">A thoughtful first step <span>01 / 06</span></div>
            </div>
          </section>}

          {isQuestion && <QuestionCard step={step} total={totalSteps} eyebrow={questionSteps[step - 1].eyebrow} question={questionSteps[step - 1].question} description={questionSteps[step - 1].description} options={questionSteps[step - 1].options} selected={answers[questionSteps[step - 1].key]} onSelect={(value) => selectAnswer(questionSteps[step - 1].key, value)} onBack={goBack} />}

          {step === 6 && <section className="contact-screen">
            <button className="back-button" onClick={goBack}><ArrowLeft size={16} /> Back</button>
            <div className="question-heading"><div className="eyebrow"><span className="eyebrow-dot" /> ALMOST THERE</div><h1>Where can we share<br className="desktop-break" /> your next steps?</h1><p>Leave your details and we&apos;ll help you understand what options may be worth exploring.</p></div>
            <form className="contact-form" onSubmit={(event) => { event.preventDefault(); void continueContact() }} noValidate>
              <div className="field-row">
                <Field label="First name" name="firstName" value={answers.firstName} error={errors.firstName} onChange={update} autoComplete="given-name" disabled={submissionStatus === 'webhook-error'} />
                <Field label="Last name" name="lastName" value={answers.lastName} error={errors.lastName} onChange={update} autoComplete="family-name" disabled={submissionStatus === 'webhook-error'} />
              </div>
              <Field label="Email address" name="email" type="email" value={answers.email} error={errors.email} onChange={update} autoComplete="email" placeholder="you@example.com" disabled={submissionStatus === 'webhook-error'} />
              <div className="field-row">
                <Field label="Phone number" name="phone" type="tel" value={answers.phone} error={errors.phone} onChange={update} autoComplete="tel" placeholder="(555) 555-5555" disabled={submissionStatus === 'webhook-error'} />
                <div className="field"><label htmlFor="state">State</label><select id="state" value={answers.state ?? ''} onChange={(event) => update('state', event.target.value)} aria-invalid={!!errors.state} disabled={submissionStatus === 'webhook-error'}><option value="">Select a state</option>{states.slice(1).map((state) => <option key={state}>{state}</option>)}</select>{errors.state && <span className="field-error">{errors.state}</span>}</div>
              </div>
              <button className="primary-button form-submit" type="submit" disabled={submissionStatus === 'loading'} aria-busy={submissionStatus === 'loading'}>
                <span aria-live="polite">{submissionStatus === 'loading' ? (supabaseLeadSaved.current ? 'Retrying delivery…' : 'Saving your information…') : submissionStatus === 'webhook-error' ? 'Retry delivery' : 'See my next steps'}</span>
                {submissionStatus !== 'loading' && <ArrowRight size={18} />}
              </button>
              {submissionStatus === 'error' && <p className="field-error" role="alert">{submissionError}</p>}
              <p className="form-privacy"><LockKeyhole size={13} /> Your information is kept private and secure.</p>
              <p className="consent-copy">By submitting, you agree that ClearPath may contact you about your inquiry. This is not an application for benefits or legal advice.</p>
            </form>
          </section>}

          {step === 7 && submissionStatus === 'success' && <section className="thanks-screen" aria-live="polite"><div className="thanks-icon"><CheckCircle2 size={34} /></div><div className="eyebrow"><span className="eyebrow-dot" /> YOU&apos;RE ALL SET</div><h1>Thank you, {answers.firstName}.</h1><p>Your information has been recorded for this session. You can now explore your answers and take your next step with more clarity.</p><div className="next-card"><span className="next-card-icon"><ShieldCheck size={21} /></span><div><strong>What happens next</strong><p>A benefits specialist can help you understand your options and answer your questions.</p></div><ChevronRight size={18} /></div><p className="disclaimer">This questionnaire is informational only. It is not an official eligibility decision, benefits application, or promise of benefits.</p><button className="text-button" onClick={() => { setStep(0); setAnswers({}); setErrors({}); resetSubmission() }}>Return to home <ArrowRight size={16} /></button></section>}
        </div>
      </main>
      <footer className="site-footer"><span>© 2026 ClearPath. All rights reserved.</span><span><LockKeyhole size={12} /> Secure, confidential questionnaire</span></footer>
    </div>
  )
}

type FieldProps = { label: string; name: keyof Answers; value?: string; error?: string; onChange: (name: keyof Answers, value: string) => void; type?: string; autoComplete?: string; placeholder?: string; disabled?: boolean }
function Field({ label, name, value, error, onChange, type = 'text', autoComplete, placeholder, disabled = false }: FieldProps) {
  return <div className="field"><label htmlFor={name}>{label}</label><input id={name} type={type} value={value ?? ''} onChange={(event) => onChange(name, event.target.value)} autoComplete={autoComplete} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} disabled={disabled} />{error && <span className="field-error" id={`${name}-error`}>{error}</span>}</div>
}
