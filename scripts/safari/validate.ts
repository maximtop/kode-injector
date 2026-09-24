/**
 * @file Validates the locally installable Safari application artifact.
 */

import path from 'node:path';

import { validateSafariArtifact } from './artifact-validator';
import { SAFARI_APP_NAME, SAFARI_BUILD_PATH, readPackageVersion } from './config';

const appPath = path.join(SAFARI_BUILD_PATH, 'dev', SAFARI_APP_NAME);

validateSafariArtifact({
    appPath,
    expectedVersion: readPackageVersion(),
    requireUniversalHelper: false,
    verifySignatures: true,
    requireProvisioningProfiles: false,
    requireAppleTeamSignature: false,
});

console.log(`Safari artifact validated: ${appPath}`);
