#!/bin/sh
set -eu

APPLICATION_NAME='Kode Injector Helper'
APPLICATION_BUNDLE_NAME="$APPLICATION_NAME.app"
MAIN_EXECUTABLE_NAME="$APPLICATION_NAME"
HOST_EXECUTABLE_NAME='kode-injector-native'
INSTALLER_EXECUTABLE_NAME='kode-injector-installer'
SUPPORTED_ARCHITECTURE_X86_64='x86_64'
SUPPORTED_ARCHITECTURE_ARM64='arm64'
NOTARY_ACCEPTED_STATUS='Accepted'

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

single_architecture() {
    executable_path=$1
    architectures=$(lipo -archs "$executable_path") || {
        fail "cannot inspect architecture for $executable_path"
    }
    set -- $architectures
    if [ "$#" -ne 1 ]; then
        fail "$executable_path must contain exactly one architecture"
    fi
    case "$1" in
        "$SUPPORTED_ARCHITECTURE_X86_64"|"$SUPPORTED_ARCHITECTURE_ARM64")
            printf '%s\n' "$1"
            ;;
        *)
            fail "$executable_path has unsupported architecture $1"
            ;;
    esac
}

require_architecture() {
    executable_path=$1
    expected_architecture=$2
    actual_architecture=$(single_architecture "$executable_path")
    if [ "$actual_architecture" != "$expected_architecture" ]; then
        fail "$executable_path must contain only $expected_architecture (found $actual_architecture)"
    fi
}

require_executable() {
    executable_path=$1
    if [ ! -f "$executable_path" ] || [ ! -x "$executable_path" ] \
        || [ -L "$executable_path" ]; then
        fail "$executable_path must be a non-symlink executable file"
    fi
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
[ -f "$DMG_PATH" ] || fail "disk image does not exist: $DMG_PATH"
WORK_DIR=$(mktemp -d)
SOURCE_MOUNT_DIR="$WORK_DIR/source-mount"
FINAL_MOUNT_DIR="$WORK_DIR/final-mount"
STAGE_DIR="$WORK_DIR/stage"
APP_ZIP_PATH="$WORK_DIR/app.zip"
APP_NOTARY_RESULT_PATH="$WORK_DIR/app-notary-result.json"
APP_NOTARY_LOG_PATH="$WORK_DIR/app-notary-log.json"
DMG_NOTARY_RESULT_PATH="$WORK_DIR/dmg-notary-result.json"
DMG_NOTARY_LOG_PATH="$WORK_DIR/dmg-notary-log.json"
SOURCE_ATTACHED=false
FINAL_ATTACHED=false

cleanup() {
    if [ "$FINAL_ATTACHED" = true ]; then
        hdiutil detach -quiet "$FINAL_MOUNT_DIR" >/dev/null 2>&1 || true
    fi
    if [ "$SOURCE_ATTACHED" = true ]; then
        hdiutil detach -quiet "$SOURCE_MOUNT_DIR" >/dev/null 2>&1 || true
    fi
    rm -rf "$WORK_DIR"
}

trap cleanup EXIT
trap 'exit 1' HUP INT TERM

notarytool_submit() {
    artifact_path=$1
    result_path=$2
    if [ "$NOTARY_AUTH_MODE" = direct ]; then
        xcrun notarytool submit "$artifact_path" \
            --key "$NOTARY_KEY_PATH" \
            --key-id "$NOTARY_KEY_ID" \
            --issuer "$NOTARY_ISSUER" \
            --wait \
            --output-format json > "$result_path"
    else
        xcrun notarytool submit "$artifact_path" \
            --keychain-profile "$NOTARY_PROFILE" \
            --wait \
            --output-format json > "$result_path"
    fi
}

notarytool_log() {
    submission_id=$1
    log_path=$2
    if [ "$NOTARY_AUTH_MODE" = direct ]; then
        xcrun notarytool log "$submission_id" \
            --key "$NOTARY_KEY_PATH" \
            --key-id "$NOTARY_KEY_ID" \
            --issuer "$NOTARY_ISSUER" \
            --output-format json > "$log_path"
    else
        xcrun notarytool log "$submission_id" \
            --keychain-profile "$NOTARY_PROFILE" \
            --output-format json > "$log_path"
    fi
}

submit_and_require_accepted() {
    artifact_label=$1
    artifact_path=$2
    result_path=$3
    log_path=$4

    notarytool_submit "$artifact_path" "$result_path"
    submission_id=$(plutil -extract id raw -o - "$result_path") || {
        fail "cannot read $artifact_label notarization submission identifier"
    }
    submission_status=$(plutil -extract status raw -o - "$result_path") || {
        fail "cannot read $artifact_label notarization status"
    }
    [ -n "$submission_id" ] || fail "$artifact_label notarization returned an empty submission identifier"
    [ -n "$submission_status" ] || fail "$artifact_label notarization returned an empty status"
    notarytool_log "$submission_id" "$log_path"
    plutil -lint "$log_path" >/dev/null || {
        fail "$artifact_label notarization log is not valid JSON"
    }
    if [ "$submission_status" != "$NOTARY_ACCEPTED_STATUS" ]; then
        fail "$artifact_label notarization status is $submission_status"
    fi
}

mkdir -p "$SOURCE_MOUNT_DIR" "$FINAL_MOUNT_DIR" "$STAGE_DIR"
hdiutil attach -quiet -nobrowse -readonly \
    -mountpoint "$SOURCE_MOUNT_DIR" "$DMG_PATH"
SOURCE_ATTACHED=true
cp -R "$SOURCE_MOUNT_DIR"/. "$STAGE_DIR"/
hdiutil detach -quiet "$SOURCE_MOUNT_DIR"
SOURCE_ATTACHED=false

APP_PATH="$STAGE_DIR/$APPLICATION_BUNDLE_NAME"
MAIN_EXECUTABLE_PATH="$APP_PATH/Contents/MacOS/$MAIN_EXECUTABLE_NAME"
HOST_EXECUTABLE_PATH="$APP_PATH/Contents/Helpers/$HOST_EXECUTABLE_NAME"
INSTALLER_EXECUTABLE_PATH="$APP_PATH/Contents/Helpers/$INSTALLER_EXECUTABLE_NAME"
[ -d "$APP_PATH" ] || fail "disk image must contain $APPLICATION_BUNDLE_NAME"
require_executable "$MAIN_EXECUTABLE_PATH"
require_executable "$HOST_EXECUTABLE_PATH"
require_executable "$INSTALLER_EXECUTABLE_PATH"

EXPECTED_ARCHITECTURE=$(single_architecture "$MAIN_EXECUTABLE_PATH")
require_architecture "$HOST_EXECUTABLE_PATH" "$EXPECTED_ARCHITECTURE"
require_architecture "$INSTALLER_EXECUTABLE_PATH" "$EXPECTED_ARCHITECTURE"

codesign --force --options runtime --timestamp \
    --sign "$APPLE_DEVELOPER_ID" "$HOST_EXECUTABLE_PATH"
codesign --force --options runtime --timestamp \
    --sign "$APPLE_DEVELOPER_ID" "$INSTALLER_EXECUTABLE_PATH"
codesign --force --options runtime --timestamp \
    --sign "$APPLE_DEVELOPER_ID" "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign --verify --strict --verbose=2 "$HOST_EXECUTABLE_PATH"
codesign --verify --strict --verbose=2 "$INSTALLER_EXECUTABLE_PATH"

ditto -c -k --keepParent "$APP_PATH" "$APP_ZIP_PATH"
submit_and_require_accepted \
    app "$APP_ZIP_PATH" "$APP_NOTARY_RESULT_PATH" "$APP_NOTARY_LOG_PATH"
xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
syspolicy_check distribution "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"

rm -f "$DMG_PATH"
hdiutil create -quiet -ov -format UDZO \
    -volname "$APPLICATION_NAME" \
    -srcfolder "$STAGE_DIR" "$DMG_PATH"
codesign --force --timestamp --sign "$APPLE_DEVELOPER_ID" "$DMG_PATH"
submit_and_require_accepted \
    disk-image "$DMG_PATH" "$DMG_NOTARY_RESULT_PATH" "$DMG_NOTARY_LOG_PATH"
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
codesign --verify --strict --verbose=2 "$DMG_PATH"
spctl --assess --type open --context context:primary-signature "$DMG_PATH"

hdiutil attach -quiet -nobrowse -readonly \
    -mountpoint "$FINAL_MOUNT_DIR" "$DMG_PATH"
FINAL_ATTACHED=true
FINAL_APP_PATH="$FINAL_MOUNT_DIR/$APPLICATION_BUNDLE_NAME"
FINAL_MAIN_EXECUTABLE_PATH="$FINAL_APP_PATH/Contents/MacOS/$MAIN_EXECUTABLE_NAME"
FINAL_HOST_EXECUTABLE_PATH="$FINAL_APP_PATH/Contents/Helpers/$HOST_EXECUTABLE_NAME"
FINAL_INSTALLER_EXECUTABLE_PATH="$FINAL_APP_PATH/Contents/Helpers/$INSTALLER_EXECUTABLE_NAME"
require_executable "$FINAL_MAIN_EXECUTABLE_PATH"
require_executable "$FINAL_HOST_EXECUTABLE_PATH"
require_executable "$FINAL_INSTALLER_EXECUTABLE_PATH"
codesign --verify --deep --strict --verbose=2 "$FINAL_APP_PATH"
codesign --verify --strict --verbose=2 "$FINAL_HOST_EXECUTABLE_PATH"
codesign --verify --strict --verbose=2 "$FINAL_INSTALLER_EXECUTABLE_PATH"
xcrun stapler validate "$FINAL_APP_PATH"
syspolicy_check distribution "$FINAL_APP_PATH"
spctl --assess --type execute --verbose=4 "$FINAL_APP_PATH"
require_architecture "$FINAL_MAIN_EXECUTABLE_PATH" "$EXPECTED_ARCHITECTURE"
require_architecture "$FINAL_HOST_EXECUTABLE_PATH" "$EXPECTED_ARCHITECTURE"
require_architecture "$FINAL_INSTALLER_EXECUTABLE_PATH" "$EXPECTED_ARCHITECTURE"
hdiutil detach -quiet "$FINAL_MOUNT_DIR"
FINAL_ATTACHED=false
