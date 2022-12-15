import { AuthAgent } from '../auth-agent';

export class OAuth1Agent extends AuthAgent {

    async getHeader(_options: any): Promise<string> {
        throw new AuthNotSupportedError();
    }

    invalidate() {}
}

export class AuthNotSupportedError extends Error {
    override name = this.constructor.name;
    override message = 'This auth agent is not supported in browser environment.';
}
