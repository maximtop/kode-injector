/**
 * @file
 */

/**
 * Delays a handler until background initialization completes.
 *
 * @param ready Shared background initialization promise.
 * @param handler Handler to invoke after initialization.
 *
 * @returns Readiness-gated handler.
 */
export const gateMessageHandler = <TArgs extends unknown[], TResult>(
    ready: Promise<void>,
    handler: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult> => {
    return async (...args: TArgs): Promise<TResult> => {
        await ready;
        return handler(...args);
    };
};
