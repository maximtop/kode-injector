/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies, no-template-curly-in-string */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

/**
 * Reads one workflow from the repository.
 *
 * @param name Workflow filename.
 *
 * @returns Workflow source.
 */
const readWorkflow = (name: string): string => fs.readFileSync(
    path.join(process.cwd(), '.github', 'workflows', name),
    'utf8',
);

/**
 * Extracts one job from a GitHub Actions workflow.
 *
 * @param workflow Workflow source.
 * @param name Job identifier.
 *
 * @returns Job configuration including its heading.
 *
 * @throws Error when the requested job is missing.
 */
const getJob = (workflow: string, name: string): string => {
    const lines = workflow.split('\n');
    const start = lines.findIndex((line) => line === `  ${name}:`);
    if (start < 0) {
        throw new Error(`Missing GitHub Actions job: ${name}`);
    }

    const endOffset = lines.slice(start + 1).findIndex((line) => (
        /^ {2}[a-z][a-z-]+:$/u.test(line)
    ));
    const end = endOffset < 0 ? lines.length : start + endOffset + 1;

    return lines.slice(start, end).join('\n');
};

test('official actions are pinned to immutable commits', () => {
    ['ci.yml', 'release.yml'].forEach((workflowName) => {
        const workflow = readWorkflow(workflowName);
        const references = workflow.match(/uses: actions\/[^\s]+@[^\s]+/gu) ?? [];

        expect(references.length, workflowName).toBeGreaterThan(0);
        references.forEach((reference) => {
            expect(reference, workflowName).toMatch(/@[\da-f]{40}$/u);
        });
    });
});

test('continuous integration validates extensions and the native host', () => {
    const workflow = readWorkflow('ci.yml');
    const extensionJob = getJob(workflow, 'extension');
    const nativeJob = getJob(workflow, 'native');

    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches: [master]');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('contents: read');
    expect(extensionJob).toContain(
        'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0',
    );
    expect(extensionJob).toContain(
        'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
    );
    expect(extensionJob).toContain("node-version: '24'");
    expect(extensionJob).toContain('corepack enable');
    expect(extensionJob).toContain('pnpm install --frozen-lockfile');
    expect(extensionJob).toContain('pnpm validate');
    expect(extensionJob).toContain('pnpm release');
    expect(nativeJob).toContain(
        'actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6.5.0',
    );
    expect(nativeJob).toContain("go-version: '1.26.x'");
    expect(nativeJob).toContain('go test -race ./...');
    expect(workflow).not.toContain('pnpm/action-setup');
});

test('release validation accepts preflights and validates version tags', () => {
    const workflow = readWorkflow('release.yml');
    const job = getJob(workflow, 'validate-release');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("tags: ['v*.*.*']");
    expect(job).toContain('fetch-depth: 0');
    expect(job).toContain('^v[0-9]+\\.[0-9]+\\.[0-9]+$');
    expect(job).toContain('PACKAGE_VERSION');
    expect(job).toContain('git fetch origin master');
    expect(job).toContain('TAG_COMMIT="$(git rev-parse "$RELEASE_TAG^{commit}")"');
    expect(job).toContain('git merge-base --is-ancestor "$TAG_COMMIT" origin/master');
    expect(job).toContain('version: ${{ steps.release-context.outputs.version }}');
});

test('release candidates use isolated Apple credentials and are retained', () => {
    const workflow = readWorkflow('release.yml');
    const job = getJob(workflow, 'build-and-sign');

    expect(job).toContain('needs: validate-release');
    expect(job).toContain('runs-on: macos-latest');
    expect(job).toContain('contents: read');
    expect(job).toContain('KODE_INJECTOR_EDGE_ID: ${{ vars.KODE_INJECTOR_EDGE_ID }}');
    expect(job).toContain('APPLE_CERTIFICATE_P12_BASE64: ${{ secrets.APPLE_CERTIFICATE_P12_BASE64 }}');
    expect(job).toContain('APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}');
    expect(job).toContain('APPLE_NOTARY_KEY_P8_BASE64: ${{ secrets.APPLE_NOTARY_KEY_P8_BASE64 }}');
    expect(job).toContain('APPLE_DEVELOPER_ID: ${{ vars.APPLE_DEVELOPER_ID }}');
    expect(job).toContain('APPLE_NOTARY_KEY_ID: ${{ vars.APPLE_NOTARY_KEY_ID }}');
    expect(job).toContain('APPLE_NOTARY_ISSUER_ID: ${{ vars.APPLE_NOTARY_ISSUER_ID }}');
    expect(job).toContain('NOTARY_KEY_PATH="$RUNNER_TEMP/kode-injector-notary-key.p8"');
    expect(job).toContain('APPLE_NOTARY_KEY_PATH=$NOTARY_KEY_PATH');
    expect(job).toContain('security create-keychain');
    expect(job).toContain('security import');
    expect(job).toContain('pnpm native:package');
    expect(job).toContain('scripts/native-host/notarize.sh');
    expect(job).toContain('shasum -a 256 kode-injector-native-* > SHA256SUMS');
    expect(job).toContain('shasum -a 256 -c SHA256SUMS');
    expect(job).toContain(
        'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1',
    );
    expect(job).toContain('retention-days: 30');
    expect(job).toContain('if: always()');
    expect(job).toContain('security delete-keychain');
    expect(job).toContain('APPLE_NOTARY_KEY_PATH:-$RUNNER_TEMP/kode-injector-notary-key.p8');
    expect(job).not.toContain('APPLE_NOTARY_PROFILE');
});

test('tag builds create a new draft release from the signed candidate', () => {
    const workflow = readWorkflow('release.yml');
    const job = getJob(workflow, 'draft-release');

    expect(job).toContain("if: github.event_name == 'push'");
    expect(job).toContain('build-and-sign');
    expect(job).toContain('contents: write');
    expect(job).toContain(
        'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1',
    );
    expect(job).toContain('sha256sum -c SHA256SUMS');
    expect(job).toContain('gh release view "$RELEASE_TAG"');
    expect(job).toContain('gh release create "$RELEASE_TAG"');
    expect(job).toContain('--draft');
    expect(job).toContain('--verify-tag');
    expect(job).toContain('GH_TOKEN: ${{ github.token }}');
    expect(job).not.toContain('--clobber');
});

test('package metadata points to GitHub and pins the pnpm version', () => {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    ) as {
        packageManager?: string;
        homepage: string;
        repository: { url: string };
        bugs: { url: string };
    };

    expect(packageJson.packageManager).toBe('pnpm@10.33.4');
    expect(packageJson.homepage).toBe('https://github.com/maximtop/kode-injector#readme');
    expect(packageJson.repository.url).toBe('https://github.com/maximtop/kode-injector.git');
    expect(packageJson.bugs.url).toBe('https://github.com/maximtop/kode-injector/issues');
});
