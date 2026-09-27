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

    await popupStore.init('de');
    popupChannel.subscribe((language) => popupStore.setLocalePreference(language));

    await optionsChannel.publish('ar');

    expect(popupStore.currentLocale).toBe('ar');
    // The broadcast must fully settle the store, not leave it mid-load or
    // out of sync with the preference that triggered the switch.
    expect(popupStore.userLocalePreference).toBe('ar');
    expect(popupStore.isLoading).toBe(false);
});
