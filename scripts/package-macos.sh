#!/bin/bash

set -euo pipefail

repository_root="$(cd "$(dirname "$0")/.." && pwd)"

cd "$repository_root"
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir

packaged_app="$(find "$repository_root/release" -maxdepth 2 -type d -name 'Shower Idea.app' -print -quit)"

if [[ -z "$packaged_app" ]]; then
  echo "Could not find Shower Idea.app in $repository_root/release" >&2
  exit 1
fi

# A local ad-hoc signature gives macOS a complete resource seal without requiring
# distribution certificates or notarization.
codesign --deep --force --sign - "$packaged_app"
codesign --verify --deep --strict --verbose=2 "$packaged_app"

echo "Packaged $packaged_app"
