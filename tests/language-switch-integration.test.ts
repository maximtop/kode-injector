/**
 * @file
 */

import { expect, test } from 'vitest';

import { LanguageChannel } from '../src/app/common/language-channel';
import { TranslationStore, type LocalePreference } from '../src/app/common/locale';

class FakeRuntime {
    private listeners = new Set<(message: unknown) => unknown>();

    public onMessage = {
        addListener: (listener: (message: unknown) => unknown): void => {
            this.listeners.add(listener);
        },
        removeListener: (listener: (message: unknown) => unknown): void => {
            this.listeners.delete(listener);
        },
    };

    public sendMessage = async (message: unknown): Promise<void> => {
        await Promise.all([...this.listeners].map((listener) => listener(message)));
    };
}

test('open UI contexts converge on a language event without resetting application state', async () => {
    const runtime = new FakeRuntime();
    const optionsChannel = new LanguageChannel(runtime);
    const popupChannel = new LanguageChannel(runtime);
    const service = {
        loadLocaleData: async (preference?: LocalePreference): Promise<'ar' | 'de'> => (
            preference === 'ar' ? 'ar' : 'de'
        ),
    };
    const popupStore = new TranslationStore(service);
    const applicationState = { injectionCount: 3, currentSite: 'example.com' };

    await popupStore.init('de');
    popupChannel.subscribe((language) => popupStore.setLocalePreference(language));

    await optionsChannel.publish('ar');

    expect(popupStore.currentLocale).toBe('ar');
    expect(applicationState).toEqual({ injectionCount: 3, currentSite: 'example.com' });
});
