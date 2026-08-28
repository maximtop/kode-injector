#!/usr/bin/env bash
set -euo pipefail

readonly EVENT_RELEASE='release'
readonly EVENT_WORKFLOW_CALL='workflow_call'
readonly EVENT_WORKFLOW_DISPATCH='workflow_dispatch'
readonly RELEASE_TAG_PATTERN='^v[0-9]+\.[0-9]+\.[0-9]+$'

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

write_output() {
    printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"
}

event_name=${EVENT_NAME:?EVENT_NAME is required}
repository=${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

case "$event_name" in
    "$EVENT_WORKFLOW_CALL" | "$EVENT_WORKFLOW_DISPATCH")
        release_tag=${INPUT_TAG:-}
        if [[ ! "$release_tag" =~ $RELEASE_TAG_PATTERN ]]; then
            fail "Release tag must match vX.Y.Z: $release_tag"
        fi
        ;;
    "$EVENT_RELEASE")
        release_tag=${EVENT_TAG:-}
        if [[ ! "$release_tag" =~ $RELEASE_TAG_PATTERN ]]; then
            printf '::notice::Release tag %s does not match vX.Y.Z; skipping store deployment.\n' \
                "$release_tag"
            write_output deploy false
            exit 0
        fi
        ;;
    *)
        fail "Unsupported store deployment event: $event_name"
        ;;
esac

release_json=$(gh release view "$release_tag" \
    --repo "$repository" --json isDraft,isPrerelease)
if [[ $(jq -r '.isDraft' <<< "$release_json") != false ]]; then
    fail "Release $release_tag is a draft; publish it before deploying to the store"
fi
if [[ $(jq -r '.isPrerelease' <<< "$release_json") != false ]]; then
    fail "Release $release_tag is a pre-release; store deployment ships full releases only"
fi

write_output deploy true
write_output tag "$release_tag"
write_output version "${release_tag#v}"
