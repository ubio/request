import { AuthAgent } from '../types';

export class BearerAuthAgent implements AuthAgent {
    params: BearerAuthParams;

    constructor(params: BearerAuthParams) {
        this.params = params;
    }

    async getHeader() {
        const { prefix = 'Bearer', token } = this.params;
        return token ? `${prefix} ${token}`: null;
    }

    invalidate() {}
}

export interface BearerAuthParams {
    prefix?: string;
    token?: string;
}
