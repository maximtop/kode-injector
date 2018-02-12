const storage = chrome.storage.local;

export const getState = () => new Promise((resolve, reject) => {
  try {
    storage.get('state', (serializedState) => {
      if (!serializedState.state) {
        resolve(undefined);
      }
      resolve(serializedState.state);
    });
  } catch (e) {
    reject(e);
  }
});

export const saveState = state => new Promise((resolve, reject) => {
  try {
    storage.set({ state }, () => resolve('state was saved'));
  } catch (e) {
    reject(e);
  }
});
