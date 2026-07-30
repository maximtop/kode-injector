/**
 * @file
 */

/**
 * Handler returned after applying the background readiness gate.
 *
 * @param args Original runtime handler arguments.
 */
type GatedMessageHandler<TArgs extends unknown[], TResult> = (
    ...args: TArgs
) => Promise<TResult>;

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
): GatedMessageHandler<TArgs, TResult> => {
    return async (...args: TArgs): Promise<TResult> => {
        await ready;
        return handler(...args);
    };
};
