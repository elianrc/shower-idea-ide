#!/bin/bash

set -euo pipefail

repository_root="$(cd "$(dirname "$0")/.." && pwd)"
source_icon="$repository_root/build/icon.png"
iconset="$repository_root/build/Vivlio.iconset"
output_icon="$repository_root/build/icon.icns"

swift "$repository_root/scripts/generate-macos-icon.swift" "$source_icon"

rm -rf "$iconset"
mkdir -p "$iconset"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$source_icon" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double_size=$((size * 2))
  sips -z "$double_size" "$double_size" "$source_icon" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil --convert icns "$iconset" --output "$output_icon"
rm -rf "$iconset"

echo "Generated $output_icon"
