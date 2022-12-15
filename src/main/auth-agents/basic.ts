import { AuthAgent } from '../auth-agent';
import { toBase64 } from '../util/base64';

export class BasicAuthAgent extends AuthAgent {
    params: BasicParams;

    constructor(params: BasicParams) {
        super();
        this.params = params;
    }

    async getHeader() {
        const { username, password } = this.params;
        const header = `${username}:${password}`;
        const authString = toBase64(header);
        return `Basic ${authString}`;
    }

    invalidate() {}
}

export interface BasicParams {
    username?: string;
    password?: string;
}
