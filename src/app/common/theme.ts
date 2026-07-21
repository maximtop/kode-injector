/**
 * @file Mantine theme shared by the options page and the popup.
 */

import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Ten-shade scale built around the brand green #00a485.
 */
const ACCENT_SCALE: MantineColorsTuple = [
    '#e3faf4',
    '#cdf2e7',
    '#9fe5d1',
    '#6dd8ba',
    '#45cda7',
    '#2cc69b',
    '#00a485',
    '#008f74',
    '#007c65',
    '#006854',
];

/**
 * Mantine theme mapping the design tokens onto Mantine primitives.
 */
export const theme = createTheme({
    primaryColor: 'accent',
    primaryShade: { light: 6, dark: 5 },
    colors: {
        accent: ACCENT_SCALE,
    },
    defaultRadius: 'md',
    fontFamily: 'var(--sans)',
    fontFamilyMonospace: 'var(--mono)',
    headings: { fontFamily: 'var(--sans)' },
    cursorType: 'pointer',
});
