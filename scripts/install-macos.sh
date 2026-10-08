#!/bin/bash

set -euo pipefail

repository_root="$(cd "$(dirname "$0")/.." && pwd)"
packaged_app="$(find "$repository_root/release" -maxdepth 2 -type d -name 'Vivlio.app' -print -quit)"
installed_app="/Applications/Vivlio.app"

if [[ -z "$packaged_app" ]]; then
  echo "Could not find Vivlio.app in $repository_root/release" >&2
  exit 1
fi

if [[ -d "$installed_app" ]]; then
  echo "Replacing the existing app in /Applications..."
fi

ditto "$packaged_app" "$installed_app"
open "$installed_app"

echo "Installed Vivlio in /Applications."
echo "To pin it: right-click its Dock icon, then choose Options > Keep in Dock."
