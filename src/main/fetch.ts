import { Fetch } from './types';

// eslint-disable-next-line import/no-default-export
export default (() => {
    if (typeof fetch !== 'undefined') {
        return fetch;
    }
    return require('node-fetch');
})() as Fetch;
