/**
 * @file Validates an Xcode archive intended for Mac App Store upload.
 */

/* eslint-disable no-console */

import path from 'node:path';
import {
    SAFARI_APP_NAME,
    SAFARI_ARCHIVE_PATH,
    readPackageVersion,
    validateBuildNumber,
} from './config';
import { validateSafariArtifact } from './artifact-validator';

const UNSIGNED_OPTION = '--unsigned';
const args = process.argv.slice(2);
const unsigned = args.includes(UNSIGNED_OPTION);
const unknownArgs = args.filter((arg) => arg !== UNSIGNED_OPTION);
if (unknownArgs.length > 0) {
    throw new Error(`Unknown Safari archive validation options: ${unknownArgs.join(', ')}`);
}

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
    verifySignatures: !unsigned,
    requireProvisioningProfiles: false,
    requireAppleTeamSignature: !unsigned,
});

console.log(`${unsigned ? 'Unsigned' : 'Signed'} Safari store archive validated:`);
console.log(SAFARI_ARCHIVE_PATH);
