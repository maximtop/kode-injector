/**
 * @file
 */

import { expect, test } from 'vitest';

import { LanguageChannel } from '../src/app/common/language-channel';

class FakeRuntime {
    private listeners: Array<(message: unknown) => unknown> = [];

    public onMessage = {
        addListener: (listener: (message: unknown) => unknown): void => {
            this.listeners.push(listener);
        },
        removeListener: (listener: (message: unknown) => unknown): void => {
            this.listeners = this.listeners.filter((item) => item !== listener);
        },
    };

    public sendMessage = async (message: unknown): Promise<void> => {
        await this.dispatch(message);
    };

    public dispatch = async (message: unknown): Promise<void> => {
        await Promise.all(this.listeners.map((listener) => listener(message)));
    };
}

test('language channel publishes and filters typed events', async () => {
    const runtime = new FakeRuntime();
    const channel = new LanguageChannel(runtime);
    const received: string[] = [];
    const unsubscribe = channel.subscribe(async (language) => {
        received.push(language);
    });

    await channel.publish('de');
    await runtime.dispatch({ type: 'unrelated', data: {} });

    expect(received).toEqual(['de']);
    unsubscribe();
    await channel.publish('fr');
    expect(received).toEqual(['de']);
});
