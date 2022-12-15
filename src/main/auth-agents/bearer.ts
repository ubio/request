import { AuthAgent } from '../auth-agent';

export class BearerAuthAgent extends AuthAgent {
    params: BearerAuthParams;

    constructor(params: BearerAuthParams) {
        super();
        this.params = params;
    }

    async getHeader() {
        const { prefix = 'Bearer', token } = this.params;
        return token ? `${prefix} ${token}` : null;
    }

    invalidate() {
    }
}

export interface BearerAuthParams {
    prefix?: string;
    token?: string;
}
