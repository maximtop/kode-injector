/**
 * @file Downloads the fixed Safari App Store provisioning profiles.
 */

/* eslint-disable no-console */

import { createPrivateKey, sign } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    SAFARI_APP_STORE_APP_PROFILE,
    SAFARI_APP_STORE_EXTENSION_PROFILE,
} from './config';

const APP_STORE_CONNECT_AUDIENCE = 'appstoreconnect-v1';
const APP_STORE_CONNECT_PROFILES_URL = 'https://api.appstoreconnect.apple.com/v1/profiles?limit=200';
const TOKEN_LIFETIME_SECONDS = 15 * 60;
const TOKEN_CLOCK_SKEW_SECONDS = 5;

/**
 * Attributes returned for an App Store Connect provisioning profile.
 */
interface ProfileAttributes {
    /**
     * Human-readable profile name configured in Apple Developer.
     */
    name: string;

    /**
     * Base64-encoded CMS provisioning profile.
     */
    profileContent: string;

    /**
     * Current lifecycle state of the profile.
     */
    profileState: string;

    /**
     * Stable UUID embedded in the provisioning profile.
     */
    uuid: string;
}

/**
 * One App Store Connect profile resource.
 */
interface ProfileResource {
    /**
     * Resource attributes used for selection and installation.
     */
    attributes: ProfileAttributes;
}

/**
 * Successful App Store Connect profiles response.
 */
interface ProfilesResponse {
    /**
     * Profiles returned by the API.
     */
    data: ProfileResource[];
}

/**
 * Encodes a JWT component without base64 padding.
 *
 * @param value UTF-8 text or JSON object to encode.
 *
 * @returns Base64url-encoded component.
 */
const encodeJwtComponent = (value: string | Record<string, unknown>): string => Buffer
    .from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url');

/**
 * Reads one required environment variable.
 *
 * @param name Environment variable name.
 *
 * @returns Non-empty configured value.
 *
 * @throws When the value is absent.
 */
const readRequiredEnvironment = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required to download Safari provisioning profiles`);
    }
    return value;
};

/**
 * Creates a short-lived App Store Connect API token.
 *
 * @returns Signed ES256 bearer token.
 */
const createAppStoreConnectToken = (): string => {
    const keyPath = readRequiredEnvironment('APP_STORE_CONNECT_API_KEY_PATH');
    const keyId = readRequiredEnvironment('APP_STORE_CONNECT_API_KEY_ID');
    const issuerId = readRequiredEnvironment('APP_STORE_CONNECT_API_ISSUER_ID');
    const issuedAt = Math.floor(Date.now() / 1000);
    const encodedHeader = encodeJwtComponent({
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT',
    });
    const encodedPayload = encodeJwtComponent({
        aud: APP_STORE_CONNECT_AUDIENCE,
        exp: issuedAt + TOKEN_LIFETIME_SECONDS,
        iat: issuedAt - TOKEN_CLOCK_SKEW_SECONDS,
        iss: issuerId,
    });
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = sign('sha256', Buffer.from(unsignedToken), {
        dsaEncoding: 'ieee-p1363',
        key: createPrivateKey(fs.readFileSync(keyPath)),
    }).toString('base64url');
    return `${unsignedToken}.${signature}`;
};

/**
 * Downloads all profiles visible to the configured API key.
 *
 * @returns App Store Connect profile resources.
 *
 * @throws When authentication or the API request fails.
 */
const downloadProfiles = async (): Promise<ProfileResource[]> => {
    const response = await fetch(APP_STORE_CONNECT_PROFILES_URL, {
        headers: {
            Authorization: `Bearer ${createAppStoreConnectToken()}`,
        },
    });
    if (!response.ok) {
        throw new Error(
            `Unable to download Safari provisioning profiles: HTTP ${response.status}`,
        );
    }
    const body = await response.json() as ProfilesResponse;
    if (!Array.isArray(body.data)) {
        throw new Error('App Store Connect returned an invalid profiles response');
    }
    return body.data;
};

/**
 * Installs one active profile under its UUID.
 *
 * @param profiles Profiles returned by App Store Connect.
 * @param profileName Exact profile name to install.
 * @param destinationDirectory Xcode provisioning profile directory.
 *
 * @throws When the named profile is absent or malformed.
 */
const installProfile = (
    profiles: ProfileResource[],
    profileName: string,
    destinationDirectory: string,
): void => {
    const profile = profiles.find(({ attributes }) => (
        attributes.name === profileName && attributes.profileState === 'ACTIVE'
    ));
    if (!profile) {
        throw new Error(`Active provisioning profile not found: ${profileName}`);
    }
    const { profileContent, uuid } = profile.attributes;
    if (!/^[0-9a-f-]{36}$/iu.test(uuid) || !profileContent) {
        throw new Error(`Invalid provisioning profile returned for ${profileName}`);
    }
    const profileData = Buffer.from(profileContent, 'base64');
    if (profileData.length === 0) {
        throw new Error(`Empty provisioning profile returned for ${profileName}`);
    }
    const destinationPath = path.join(destinationDirectory, `${uuid}.provisionprofile`);
    fs.writeFileSync(destinationPath, profileData, { mode: 0o600 });
    console.log(`Installed ${profileName} (${uuid})`);
};

const destinationDirectory = process.env.SAFARI_PROVISIONING_PROFILES_PATH
    ?? path.join(os.homedir(), 'Library/MobileDevice/Provisioning Profiles');
fs.mkdirSync(destinationDirectory, { recursive: true, mode: 0o700 });

const profiles = await downloadProfiles();
installProfile(profiles, SAFARI_APP_STORE_APP_PROFILE, destinationDirectory);
installProfile(profiles, SAFARI_APP_STORE_EXTENSION_PROFILE, destinationDirectory);
