#!/bin/sh
set -eu

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

[ -n "${APPLE_DEVELOPER_ID:-}" ] || fail "APPLE_DEVELOPER_ID is required"

NOTARY_PROFILE=${APPLE_NOTARY_PROFILE:-}
NOTARY_KEY_PATH=${APPLE_NOTARY_KEY_PATH:-}
NOTARY_KEY_ID=${APPLE_NOTARY_KEY_ID:-}
NOTARY_ISSUER=${APPLE_NOTARY_ISSUER_ID:-}
DIRECT_AUTH_CONFIGURED=false
if [ -n "$NOTARY_KEY_PATH" ] || [ -n "$NOTARY_KEY_ID" ] || [ -n "$NOTARY_ISSUER" ]; then
    DIRECT_AUTH_CONFIGURED=true
fi
if [ -n "$NOTARY_PROFILE" ] && [ "$DIRECT_AUTH_CONFIGURED" = true ]; then
    fail "configure exactly one notarization auth mode: APPLE_NOTARY_PROFILE or direct API key credentials"
fi
if [ "$DIRECT_AUTH_CONFIGURED" = true ]; then
    if [ -z "$NOTARY_KEY_PATH" ] || [ -z "$NOTARY_KEY_ID" ] || [ -z "$NOTARY_ISSUER" ]; then
        fail "direct notarization auth requires APPLE_NOTARY_KEY_PATH, APPLE_NOTARY_KEY_ID, and APPLE_NOTARY_ISSUER_ID"
    fi
    [ -r "$NOTARY_KEY_PATH" ] || fail "APPLE_NOTARY_KEY_PATH must point to a readable API key file"
    NOTARY_AUTH_MODE=direct
elif [ -n "$NOTARY_PROFILE" ]; then
    NOTARY_AUTH_MODE=profile
else
    fail "configure exactly one notarization auth mode: APPLE_NOTARY_PROFILE or direct API key credentials"
fi

DMG_PATH=${1:-}
[ -n "$DMG_PATH" ] || fail "usage: notarize.sh path/to/package.dmg"
WORK_DIR=$(mktemp -d)
MOUNT_DIR="$WORK_DIR/mount"
STAGE_DIR="$WORK_DIR/stage"
trap 'hdiutil detach "$MOUNT_DIR" >/dev/null 2>&1 || true; rm -rf "$WORK_DIR"' EXIT

mkdir -p "$MOUNT_DIR" "$STAGE_DIR"
hdiutil attach -quiet -nobrowse -mountpoint "$MOUNT_DIR" "$DMG_PATH"
cp -R "$MOUNT_DIR"/. "$STAGE_DIR"/
hdiutil detach -quiet "$MOUNT_DIR"
codesign --force --options runtime --timestamp --sign "$APPLE_DEVELOPER_ID" "$STAGE_DIR/kode-injector-native"
codesign --force --options runtime --timestamp --sign "$APPLE_DEVELOPER_ID" "$STAGE_DIR/kode-injector-installer"
rm -f "$DMG_PATH"
hdiutil create -quiet -ov -format UDZO -srcfolder "$STAGE_DIR" "$DMG_PATH"
codesign --force --timestamp --sign "$APPLE_DEVELOPER_ID" "$DMG_PATH"
if [ "$NOTARY_AUTH_MODE" = direct ]; then
    xcrun notarytool submit "$DMG_PATH" \
        --key "$NOTARY_KEY_PATH" \
        --key-id "$NOTARY_KEY_ID" \
        --issuer "$NOTARY_ISSUER" \
        --wait
else
    xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
fi
xcrun stapler staple "$DMG_PATH"
codesign --verify --strict "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature "$DMG_PATH"
