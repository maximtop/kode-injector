const storage = chrome.storage.local;

export const getState = key => new Promise((resolve, reject) => {
    try {
        storage.get(key, (serializedState) => {
            if (!serializedState[key]) {
                resolve(undefined);
            }
            resolve(serializedState[key]);
        });
    } catch (e) {
        reject(e);
    }
});

export const setState = (key, state) => new Promise((resolve, reject) => {
    try {
        storage.set({ [key]: state }, () => resolve(`${state} was saved under ${key}`));
    } catch (e) {
        reject(e);
    }
});
