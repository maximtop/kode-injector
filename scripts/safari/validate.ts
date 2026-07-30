/**
 * @file Validates the locally installable Safari application artifact.
 */

/* eslint-disable no-console */

import path from 'node:path';
import { SAFARI_APP_NAME, SAFARI_BUILD_PATH, readPackageVersion } from './config';
import { validateSafariArtifact } from './artifact-validator';

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
