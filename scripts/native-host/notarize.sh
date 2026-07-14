#!/bin/sh
set -eu

: "${APPLE_DEVELOPER_ID:?APPLE_DEVELOPER_ID is required}"
: "${APPLE_NOTARY_PROFILE:?APPLE_NOTARY_PROFILE is required}"

DMG_PATH=${1:?usage: notarize.sh path/to/package.dmg}
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
xcrun notarytool submit "$DMG_PATH" --keychain-profile "$APPLE_NOTARY_PROFILE" --wait
xcrun stapler staple "$DMG_PATH"
codesign --verify --strict "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature "$DMG_PATH"
