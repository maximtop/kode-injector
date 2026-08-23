#!/usr/bin/env bash
# Bumps the package version for a release and emits the branch and tag names.
#
# Inputs (environment):
#   VERSION            next semantic version, X.Y.Z (required)
#   PACKAGE_JSON_PATH  package.json to update (default: package.json)
#   EXISTING_TAGS      newline-separated tags that already exist (optional)
#   GITHUB_OUTPUT      file receiving version=, tag=, branch= (required)
set -euo pipefail

readonly VERSION_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+$'
readonly RELEASE_BRANCH_PREFIX='feature/release-'

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

write_output() {
    printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"
}

version=${VERSION:?VERSION is required}
package_path=${PACKAGE_JSON_PATH:-package.json}
existing_tags=${EXISTING_TAGS:-}
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

if [[ ! "$version" =~ $VERSION_PATTERN ]]; then
    fail "Version must match X.Y.Z: $version"
fi
[[ -f "$package_path" ]] || fail "Missing package manifest: $package_path"

current_version=$(node -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.stdout.write(String(manifest.version ?? ""));
' "$package_path")
if [[ ! "$current_version" =~ $VERSION_PATTERN ]]; then
    fail "Current package version is not semantic: $current_version"
fi

highest=$(printf '%s\n%s\n' "$current_version" "$version" | sort -V | tail -n 1)
if [[ "$version" == "$current_version" || "$highest" != "$version" ]]; then
    fail "Version $version must be higher than the current $current_version"
fi

tag="v$version"
if [[ -n "$existing_tags" ]] && grep -qxF -- "$tag" <<< "$existing_tags"; then
    fail "Tag $tag already exists"
fi

node -e '
const fs = require("node:fs");
const [path, version] = process.argv.slice(1);
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
manifest.version = version;
fs.writeFileSync(path, `${JSON.stringify(manifest, null, 4)}\n`);
' "$package_path" "$version"

write_output version "$version"
write_output tag "$tag"
write_output branch "${RELEASE_BRANCH_PREFIX}${version}"
printf 'Bumped %s from %s to %s\n' "$package_path" "$current_version" "$version"
