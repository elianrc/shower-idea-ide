import { ArrowRight, FolderGit2, GitBranch, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandMark } from './BrandMark'

export function Onboarding({ onOpen, isLoading }: { onOpen(): void; isLoading: boolean }) {
  return (
    <main className="onboarding">
      <div className="onboarding-window-drag" />
      <section className="onboarding-card">
        <div className="onboarding-brand"><BrandMark size={38} /></div>
        <p className="eyebrow">Agent-first development</p>
        <h1>Turn intent into<br />reviewable software.</h1>
        <p className="onboarding-lede">
          Give an agent a task. Follow meaningful progress. Verify the result, inspect every change,
          and approve when it is ready.
        </p>
        <button className="primary-button large" disabled={isLoading} onClick={onOpen} type="button">
          <FolderGit2 size={18} />
          {isLoading ? 'Opening…' : 'Open a Git repository'}
          <ArrowRight className="button-trailing" size={17} />
        </button>
        <div className="onboarding-features">
          <span><Sparkles size={14} /> Agent-led</span>
          <span><GitBranch size={14} /> Git-isolated</span>
          <span><ShieldCheck size={14} /> Human-approved</span>
        </div>
      </section>
      <p className="onboarding-note">Your code and task history stay on this machine.</p>
    </main>
  )
}
