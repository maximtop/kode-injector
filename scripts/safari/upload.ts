/**
 * @file Explicitly exports and uploads a signed Safari archive to App Store Connect.
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import {
    SAFARI_APP_NAME,
    SAFARI_APP_BUNDLE_IDENTIFIER,
    SAFARI_ARCHIVE_PATH,
    SAFARI_APP_STORE_APP_PROFILE,
    SAFARI_APP_STORE_EXTENSION_PROFILE,
    SAFARI_EXTENSION_BUNDLE_IDENTIFIER,
    SAFARI_STORE_PATH,
    appStoreConnectAuthenticationArgs,
    readAppleTeamIdentifier,
    readPackageVersion,
    run,
    validateBuildNumber,
} from './config';
import { validateSafariArtifact } from './artifact-validator';

const teamIdentifier = readAppleTeamIdentifier();

const expectedBuildNumber = process.env.SAFARI_BUILD_NUMBER
    ? validateBuildNumber(process.env.SAFARI_BUILD_NUMBER)
    : undefined;
const appPath = path.join(
    SAFARI_ARCHIVE_PATH,
    'Products/Applications',
    SAFARI_APP_NAME,
);
validateSafariArtifact({
    appPath,
    expectedVersion: readPackageVersion(),
    expectedBuildNumber,
    requireUniversalHelper: true,
    verifySignatures: true,
    requireProvisioningProfiles: true,
    requireAppleTeamSignature: true,
});

const exportPath = path.join(SAFARI_STORE_PATH, 'upload');
const exportOptionsPath = path.join(SAFARI_STORE_PATH, 'ExportOptions.plist');
const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>destination</key>
    <string>upload</string>
    <key>manageAppVersionAndBuildNumber</key>
    <false/>
    <key>method</key>
    <string>app-store-connect</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>signingCertificate</key>
    <string>Apple Distribution</string>
    <key>installerSigningCertificate</key>
    <string>3rd Party Mac Developer Installer</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>${SAFARI_APP_BUNDLE_IDENTIFIER}</key>
        <string>${SAFARI_APP_STORE_APP_PROFILE}</string>
        <key>${SAFARI_EXTENSION_BUNDLE_IDENTIFIER}</key>
        <string>${SAFARI_APP_STORE_EXTENSION_PROFILE}</string>
    </dict>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>teamID</key>
    <string>${teamIdentifier}</string>
</dict>
</plist>
`;

fs.rmSync(exportPath, { recursive: true, force: true });
fs.mkdirSync(SAFARI_STORE_PATH, { recursive: true });
fs.writeFileSync(exportOptionsPath, exportOptions, { mode: 0o600 });

run('xcodebuild', [
    '-exportArchive',
    '-archivePath',
    SAFARI_ARCHIVE_PATH,
    '-exportPath',
    exportPath,
    '-exportOptionsPlist',
    exportOptionsPath,
    ...appStoreConnectAuthenticationArgs(),
]);

console.log('Safari build uploaded to App Store Connect for processing.');
