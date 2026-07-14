/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const ciConfiguration = fs.readFileSync(
    path.join(process.cwd(), '.gitlab-ci.yml'),
    'utf8',
);

/**
 * Extracts one top-level GitLab CI block.
 *
 * @param name Top-level job name.
 *
 * @returns Job configuration including its heading.
 *
 * @throws Error when the requested job is missing.
 */
const getJob = (name: string): string => {
    const lines = ciConfiguration.split('\n');
    const start = lines.findIndex((line) => line === `${name}:`);
    if (start < 0) {
        throw new Error(`Missing GitLab CI job: ${name}`);
    }

    const endOffset = lines.slice(start + 1).findIndex((line) => (
        line.length > 0 && !/^\s/u.test(line)
    ));
    const end = endOffset < 0 ? lines.length : start + endOffset + 1;

    return lines.slice(start, end).join('\n');
};

test('tag signing retains a downloadable verified release candidate', () => {
    const job = getJob('native-sign');

    expect(job).toContain('$CI_COMMIT_TAG =~ /^v[0-9]+\\.[0-9]+\\.[0-9]+$/');
    expect(job).toContain('test "$PACKAGE_VERSION" = "$(node -p');
    expect(job).toContain('shasum -a 256 kode-injector-native-* > SHA256SUMS');
    expect(job).toContain('- build/native/');
    expect(job).toContain('expire_in: 30 days');
});

test('release publication is an explicit blocking action', () => {
    const job = getJob('publish-release');

    expect(job).toContain('when: manual');
    expect(job).toContain('allow_failure: false');
    expect(job).toContain('job: native-sign');
    expect(job).toContain('artifacts: true');
    expect(job).not.toContain('job: native-package');
});

test('release publication validates and publishes only signed artifacts', () => {
    const job = getJob('publish-release');

    expect(job).toContain('test "$PACKAGE_VERSION" = "$PACKAGE_JSON_VERSION"');
    expect(job).toContain('sha256sum -c SHA256SUMS');
    expect(job).toContain('glab release create "$CI_COMMIT_TAG"');
    expect(job).toContain('build/native/$PACKAGE_VERSION/*');
    expect(job).toContain('--use-package-registry');
    expect(job).toContain('--package-name kode-injector-native');
    expect(job).toContain('--no-update');
});
