#!/bin/bash

set -euo pipefail

: "${SRCROOT:?Missing Xcode source root}"
: "${TARGET_BUILD_DIR:?Missing target build directory}"
: "${CONTENTS_FOLDER_PATH:?Missing target contents path}"

helper_path="$TARGET_BUILD_DIR/$CONTENTS_FOLDER_PATH/Helpers/kode-injector-native"
entitlements_path="$SRCROOT/Kode Injector Extension/Kode Injector Native.entitlements"

[[ -f "$helper_path" ]] || {
    echo "Missing generated Safari native helper" >&2
    exit 1
}

if [[ "${CODE_SIGNING_ALLOWED:-NO}" != "YES" ]]; then
    exit 0
fi

: "${EXPANDED_CODE_SIGN_IDENTITY:?Missing Xcode signing identity}"

/usr/bin/codesign \
    --force \
    --sign "$EXPANDED_CODE_SIGN_IDENTITY" \
    --entitlements "$entitlements_path" \
    --generate-entitlement-der \
    "$helper_path"
