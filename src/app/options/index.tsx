/**
 * @file
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '../common/styles/tokens.pcss';
import '../common/styles/mantine-overrides.pcss';

import { applyInitialColorScheme } from '../common/color-scheme';
import { OptionsApp } from './components/OptionsApp';

/**
 * Mounts the options application into the page.
 */
export const optionsPage = () => {
    const root = document.getElementById('root');

    if (root) {
        applyInitialColorScheme();
        createRoot(root).render(<OptionsApp />);
    }
};
