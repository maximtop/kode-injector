/**
 * @file Inline SVG icons ported from the design prototype.
 */

import React from 'react';

/**
 * Props shared by all inline icons.
 */
interface IconProps {
    /**
     * Rendered icon size in pixels.
     */
    size: number;
}

/**
 * Props of the icon frame.
 */
interface IconFrameProps extends IconProps {
    /**
     * SVG path contents.
     */
    children: React.ReactNode;
}

/**
 * Shared SVG frame with the prototype's stroke styling.
 *
 * @param props Frame props.
 *
 * @returns Decorative SVG element.
 */
const IconFrame = ({ size, children }: IconFrameProps): React.JSX.Element => {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {children}
        </svg>
    );
};

/**
 * Pause icon: two vertical bars.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconPause = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <path d="M9 5v14M15 5v14" />
        </IconFrame>
    );
};

/**
 * Moon icon used by the theme toggle.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconMoon = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z" />
        </IconFrame>
    );
};

/**
 * Sun icon shown while the light scheme is active.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconSun = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <circle cx={12} cy={12} r={4} />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </IconFrame>
    );
};

/**
 * Half-filled circle shown while the scheme follows the system.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconContrast = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <circle cx={12} cy={12} r={9} />
            <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
        </IconFrame>
    );
};

/**
 * GitHub mark.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconGitHub = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.6-1-3.7.3-1.2.3-2.5 0-3.7 0 0-1 0-3 1.5-2.6-.5-5.4-.5-8 0C6 1.6 5 1.6 5 1.6c-.3 1.2-.3 2.5 0 3.7-.7 1.1-1.1 2.4-1 3.7 0 3.5 3 5.5 6 5.5a4.8 4.8 0 0 0-1 3.5v4" />
            <path d="M9 18c-4.5 2-5-2-7-2" />
        </IconFrame>
    );
};

/**
 * Search icon: magnifier.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconSearch = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <circle cx={11} cy={11} r={7} />
            <path d="m20 20-3.5-3.5" />
        </IconFrame>
    );
};

/**
 * Plus icon used by primary creation actions.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconPlus = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <path d="M12 5v14M5 12h14" />
        </IconFrame>
    );
};

/**
 * Vertical dots icon used by overflow menus.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconDots = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <circle cx={12} cy={5} r={1.6} fill="currentColor" stroke="none" />
            <circle cx={12} cy={12} r={1.6} fill="currentColor" stroke="none" />
            <circle cx={12} cy={19} r={1.6} fill="currentColor" stroke="none" />
        </IconFrame>
    );
};

/**
 * Close icon: diagonal cross.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconClose = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <path d="M6 6l12 12M18 6 6 18" />
        </IconFrame>
    );
};

/**
 * Gear icon used by options links.
 *
 * @param props Icon props.
 *
 * @returns Decorative SVG element.
 */
export const IconGear = ({ size }: IconProps): React.JSX.Element => {
    return (
        <IconFrame size={size}>
            <circle cx={12} cy={12} r={3} />
            <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.5-1-2 3.4 2.1 1.6a7 7 0 0 0 0 2.4L3 14.8l2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.5 1 2-3.4-2.1-1.6c.1-.4.1-.8.1-1.2Z" />
        </IconFrame>
    );
};
