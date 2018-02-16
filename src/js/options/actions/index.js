import { createAction } from 'redux-actions';
import url from 'url';

export const addInjection = createAction('INJECTION_ADD', (injection) => {
  const { siteUrl } = injection;
  let hostname;
  try {
    // eslint-disable-next-line prefer-destructuring
    hostname = url.parse(siteUrl).hostname;
  } catch (e) {
    throw new Error(`sorry something wrong with your link: ${e}`);
  }
  console.log(hostname);
  return {
    injection: {
      ...injection,
      siteUrl: hostname || siteUrl,
      state: 'active',
    },
  };
});
export const removeInjection = createAction('INJECTION_REMOVE');

export const toggleInjectionState = createAction('INJECTION_STATE_TOGGLE');
