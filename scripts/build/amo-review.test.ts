/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    AMO_REVIEW_SECTION_HEADING,
    AMO_REVIEW_TOC_ANCHOR,
    APPROVAL_NOTES,
    appendAmoReviewSection,
} from './amo-review';

const README_FIXTURE = [
    '# Kode Injector',
    '',
    '## Table of Contents',
    '',
    '- [Installation](#installation)',
    AMO_REVIEW_TOC_ANCHOR,
    '',
    '## Installation',
    '',
    'Install things.',
    '',
].join('\n');

test('appendAmoReviewSection links the section from the TOC and appends it', () => {
    const result = appendAmoReviewSection(README_FIXTURE);

    expect(result).not.toContain(AMO_REVIEW_TOC_ANCHOR);
    expect(result).toContain(
        '- [Building Instructions for Firefox Add-ons Review Team]'
        + '(#building-instructions-for-firefox-add-ons-review-team)',
    );
    expect(result).toContain(AMO_REVIEW_SECTION_HEADING);
    expect(result.indexOf(AMO_REVIEW_SECTION_HEADING))
        .toBeGreaterThan(result.indexOf('## Installation'));
    expect(result).toContain('pnpm release firefox');
});

test('appendAmoReviewSection throws when the TOC anchor is missing', () => {
    expect(() => appendAmoReviewSection('# Kode Injector\n')).toThrow(/TOC:AMO_REVIEW/);
});

test('approval notes point reviewers at the archived README section', () => {
    expect(APPROVAL_NOTES).toContain('source.zip');
    expect(APPROVAL_NOTES).toContain('README.md');
    expect(APPROVAL_NOTES).toContain('Building Instructions for Firefox Add-ons Review Team');
    expect(APPROVAL_NOTES).toContain('pnpm release firefox');
});
