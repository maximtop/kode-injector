/**
 * @file
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '../common/styles/tokens.pcss';
import '../common/styles/mantine-overrides.pcss';

import { applyInitialColorScheme } from '../common/color-scheme';
import { PopupApp } from './components/PopupApp';

/**
 * Mounts the popup application into the page.
 */
export const popupPage = () => {
    const root = document.getElementById('root');

    if (root) {
        applyInitialColorScheme();
        createRoot(root).render(<PopupApp />);
    }
};
