import * as React from 'react'
import { Dialog, DialogContent, DefaultDialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'

interface ITermsAndConditionsProps {
  /** A function called when the dialog is dismissed. */
  readonly onDismissed: () => void
}

const repository = 'https://github.com/elianrc/shower-idea-ide'
const githubTerms = 'https://docs.github.com/en/site-policy/github-terms'
const githubPrivacy =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement'

export class TermsAndConditions extends React.Component<ITermsAndConditionsProps> {
  public render() {
    return (
      <Dialog
        id="terms-and-conditions"
        title="Legal and Third-Party Services"
        onSubmit={this.props.onDismissed}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>
          <h2>Open source</h2>
          <p>
            Vivlio is an independent open-source application distributed under
            the MIT License. Its source code and license are available in the{' '}
            <LinkButton uri={repository}>Vivlio repository</LinkButton>.
            Additional notices for bundled software are available under License
            and Open Source Notices.
          </p>

          <h2>Connected services</h2>
          <p>
            When you connect Vivlio to GitHub.com or GitHub Enterprise, your use
            of those services remains governed by the applicable{' '}
            <LinkButton uri={githubTerms}>GitHub terms</LinkButton> and{' '}
            <LinkButton uri={githubPrivacy}>privacy statement</LinkButton>.
            Codex, Claude Code, and any other configured provider are likewise
            governed by the terms associated with your provider account.
          </p>

          <h2>Privacy and network access</h2>
          <p>
            This build does not send Vivlio usage reports, crash reports, or
            update requests unless the build has been configured with explicit
            Vivlio-owned service endpoints. Repository remotes and connected
            provider features still make the network requests required for the
            actions you initiate.
          </p>

          <h2>Trademarks</h2>
          <p>
            GitHub, GitHub Desktop, Claude, Claude Code, Codex, VS Code, and
            Monaco are trademarks of their respective owners. Vivlio is not
            affiliated with or endorsed by those owners.
          </p>
        </DialogContent>

        <DefaultDialogFooter />
      </Dialog>
    )
  }
}
