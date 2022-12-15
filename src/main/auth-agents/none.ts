import { AuthAgent } from '../auth-agent';

export class NoAuthAgent extends AuthAgent {

    async getHeader() {
        return null;
    }

    invalidate() {}
}
