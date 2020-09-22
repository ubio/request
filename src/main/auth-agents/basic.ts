import { AuthAgent } from '../auth-agent';

export class BasicAuthAgent extends AuthAgent {
    params: BasicParams;

    constructor(params: BasicParams) {
        super();
        this.params = params;
    }

    async getHeader() {
        const { username, password } = this.params;
        const header = `${username}:${password}`;
        const authString = Buffer.from(header, 'utf8').toString('base64');
        return `Basic ${authString}`;
    }

    invalidate() {
    }
}

export interface BasicParams {
    username?: string;
    password?: string;
}
