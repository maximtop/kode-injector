/**
 * @file Shared Mantine providers for the options page and the popup.
 */

import React, { useEffect } from 'react';
import {
    DirectionProvider,
    MantineProvider,
    useDirection,
} from '@mantine/core';

import { colorSchemeManager } from '../color-scheme';
import { theme } from '../theme';

/**
 * Text direction supported by the interface.
 */
type Direction = 'ltr' | 'rtl';

/**
 * Props of the direction synchronization bridge.
 */
interface DirectionBridgeProps {
    /**
     * Direction requested by the active locale.
     */
    direction: Direction;
}

/**
 * Keeps Mantine's direction context in sync with the active locale.
 *
 * @param props Bridge props.
 *
 * @returns Nothing; the component only synchronizes context.
 */
const DirectionBridge = ({ direction }: DirectionBridgeProps): null => {
    const { dir, setDirection } = useDirection();

    useEffect(() => {
        if (dir !== direction) {
            setDirection(direction);
        }
    }, [dir, direction, setDirection]);

    return null;
};

/**
 * Props of the shared provider stack.
 */
interface AppProvidersProps {
    /**
     * Direction requested by the active locale.
     */
    direction: Direction;

    /**
     * Application subtree.
     */
    children: React.ReactNode;
}

/**
 * Wraps a page in the shared Mantine provider stack.
 *
 * @param props Provider props.
 *
 * @returns Provider-wrapped subtree.
 */
export const AppProviders = ({ direction, children }: AppProvidersProps): React.JSX.Element => {
    return (
        <DirectionProvider initialDirection={direction} detectDirection={false}>
            <MantineProvider
                theme={theme}
                colorSchemeManager={colorSchemeManager}
                defaultColorScheme="auto"
            >
                <DirectionBridge direction={direction} />
                {children}
            </MantineProvider>
        </DirectionProvider>
    );
};
