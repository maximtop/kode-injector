/**
 * @file Kode Injector built-in demo: JavaScript applied to https://example.com.
 *
 * Fixed product content shipped with the Safari extension. It must stay
 * self-contained: no imports, no network access, no extension APIs.
 */

// Nothing leaks into the page's global scope; re-evaluation is idempotent.
(() => {
    const DEMO_ELEMENT_ID = 'kode-injector-demo';
    const DEMO_ATTRIBUTE = 'data-kode-injector-demo';
    const CSS_MARKER_PROPERTY = '--kode-injector-demo-css';
    const CSS_MARKER_VALUE = 'applied';
    const CSS_RECHECK_DELAY_MS = 500;
    const PANEL_STYLE = [
        'position: fixed',
        'top: 16px',
        'right: 16px',
        'z-index: 2147483647',
        'max-width: 340px',
        'padding: 14px 16px',
        'border-radius: 12px',
        'background: #ffffff',
        'color: #1e2a28',
        'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18)',
        'font: 14px/1.5 system-ui, -apple-system, sans-serif',
    ].join('; ');

    /**
     * Reports whether the demo stylesheet is currently applied to this document.
     */
    const isCssApplied = () => {
        const value = window.getComputedStyle(document.documentElement)
            .getPropertyValue(CSS_MARKER_PROPERTY)
            .trim();
        return value === CSS_MARKER_VALUE;
    };

    /**
     * Describes the CSS effect honestly, based on what this document observes.
     */
    const describeCss = () => (isCssApplied()
        ? 'CSS: the green page background and the banner at the top come from the injected stylesheet.'
        : 'CSS: the injected stylesheet was not detected on this page.');

    /**
     * Creates one text line of the demo panel.
     *
     * @param id Element id.
     * @param text Visible text.
     */
    const createLine = (id, text) => {
        const line = document.createElement('p');
        line.id = id;
        line.textContent = text;
        line.style.cssText = 'margin: 0 0 4px;';
        return line;
    };

    /**
     * Inserts the branded demo panel once per document.
     */
    const renderDemo = () => {
        const root = document.documentElement;
        if (!root || document.getElementById(DEMO_ELEMENT_ID)) {
            return;
        }
        root.setAttribute(DEMO_ATTRIBUTE, 'applied');

        const panel = document.createElement('section');
        panel.id = DEMO_ELEMENT_ID;
        panel.setAttribute('role', 'status');
        panel.setAttribute('aria-live', 'polite');
        panel.style.cssText = PANEL_STYLE;

        const title = document.createElement('strong');
        title.textContent = 'Kode Injector demo';
        title.style.cssText = 'display: block; font-size: 15px; margin-bottom: 6px;';

        const cssLine = createLine(`${DEMO_ELEMENT_ID}-css`, describeCss());
        panel.append(
            title,
            createLine(
                `${DEMO_ELEMENT_ID}-js`,
                'This panel was created by the injected JavaScript.',
            ),
            cssLine,
        );
        (document.body || root).appendChild(panel);

        // The stylesheet arrives right after the script; re-check once so the
        // panel never describes CSS that is present as missing.
        window.setTimeout(() => {
            cssLine.textContent = describeCss();
        }, CSS_RECHECK_DELAY_MS);
    };

    if (document.body) {
        renderDemo();
    } else {
        document.addEventListener('DOMContentLoaded', renderDemo, { once: true });
    }
})();
