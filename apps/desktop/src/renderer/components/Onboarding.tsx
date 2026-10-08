import { ArrowRight, FolderGit2, GitBranch, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandMark } from './BrandMark'

export function Onboarding({ onOpen, isLoading }: { onOpen(): void; isLoading: boolean }) {
  return (
    <main className="onboarding">
      <div className="onboarding-window-drag" />
      <section className="onboarding-card">
        <div className="onboarding-brand"><BrandMark size={38} /></div>
        <p className="eyebrow">Local agent workspace</p>
        <h1>Your repositories.<br />Your coding agents.</h1>
        <p className="onboarding-lede">
          Open a repository, start a local coding-agent session, and keep the conversation, Git context,
          and every change together.
        </p>
        <button className="primary-button large" disabled={isLoading} onClick={onOpen} type="button">
          <FolderGit2 size={18} />
          {isLoading ? 'Opening…' : 'Open a Git repository'}
          <ArrowRight className="button-trailing" size={17} />
        </button>
        <div className="onboarding-features">
          <span><Sparkles size={14} /> Persistent sessions</span>
          <span><GitBranch size={14} /> Branch-aware</span>
          <span><ShieldCheck size={14} /> Local CLI agents</span>
        </div>
      </section>
      <p className="onboarding-note">Your code and session history stay on this machine.</p>
    </main>
  )
}
