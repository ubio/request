import { Fetch } from './types';

// eslint-disable-next-line import/no-default-export
export default (() => {
    if (typeof window !== 'undefined' && (window as any).fetch) {
        return fetch;
    }
    return require('node-fetch');
})() as Fetch;
