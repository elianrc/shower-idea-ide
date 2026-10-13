# GitHub sign-in setup

Vivlio uses a GitHub App user access token for browser-based sign-in. The desktop
application is open source and contains only public configuration. The GitHub
client secret stays in a small stateless broker and is never bundled into the
app.

## Architecture

1. Vivlio creates a random state value and PKCE verifier.
2. The user's default browser opens GitHub's authorization page.
3. GitHub redirects to `vivlio://auth/github` and macOS reopens Vivlio.
4. Vivlio validates the state and sends the one-time code plus PKCE verifier to
   the broker over HTTPS.
5. The broker adds the GitHub client secret and exchanges the code. It does not
   store the returned token.
6. Vivlio encrypts the token with Electron `safeStorage` (macOS Keychain-backed)
   and exposes it to Git only through `GIT_ASKPASS` for the duration of a Git
   command.

Tokens are never written into a remote URL, repository configuration, log, or
renderer storage. Local-only use does not require a GitHub account.

## 1. Create the GitHub App

In GitHub, open **Settings > Developer settings > GitHub Apps > New GitHub App**
and configure:

- Callback URL: `vivlio://auth/github`
- Webhooks: inactive (Vivlio does not use them yet)
- Repository permissions:
  - Contents: Read and write
  - Metadata: Read-only
- Account permissions: none
- Where the app can be installed: Any account

Enable expiring user access tokens. Vivlio supports refresh tokens and will
refresh shortly before expiry. No private key is required for this user-to-server
flow.

Copy the app's **Client ID** and create a **Client secret**. The client ID is
public; the client secret must exist only in the broker's server environment.

## 2. Deploy the broker

Deploy `apps/auth-broker` as a Vercel project with that folder selected as its
Root Directory. Add these production environment variables:

```text
GITHUB_CLIENT_ID=<GitHub App client ID>
GITHUB_CLIENT_SECRET=<GitHub App client secret>
VIVLIO_GITHUB_REDIRECT_URI=vivlio://auth/github
```

The broker has only three endpoints:

- `GET /api/health`
- `POST /api/github/exchange`
- `POST /api/github/refresh`

Use HTTPS in production. Add provider-side rate limiting before a public launch.
Rotating the GitHub secret requires only updating the broker environment.

## 3. Build Vivlio with the public configuration

Set these variables when building the desktop app:

```bash
export VIVLIO_GITHUB_CLIENT_ID='<GitHub App client ID>'
export VIVLIO_GITHUB_AUTH_BROKER_URL='https://your-broker.example.com'
npm run install:mac
```

The values are compiled into the main process. Neither value is secret. A build
without them continues to work locally and shows that GitHub sign-in is not
configured.

## 4. Test

1. Open an HTTPS GitHub repository in Vivlio.
2. Open the repository menu and choose **Sign in with GitHub**.
3. Authorize and, if prompted, install the GitHub App for the account or
   organization that owns the repository.
4. Return to Vivlio and choose **Fetch origin**.
5. Sign out from the repository menu and confirm private fetches request sign-in
   again.

For organization repositories, an organization owner may need to approve or
install the app. GitHub App permissions remain narrower and easier to audit than
a broadly scoped classic personal access token.

## Open-source forks

Forks should register their own GitHub App and deploy their own broker. Do not
copy the official Vivlio client secret. Publishing the desktop source, client ID,
callback scheme, and broker source is expected; the security boundary is the
server-held client secret plus PKCE and state validation.

References: [Authenticating with a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app), [generating a user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app), and [GitHub App best practices](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app).
