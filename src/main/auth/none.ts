import { AuthAgent } from '../types';

export class NoAuthAgent implements AuthAgent {

    async getHeader() {
        return null;
    }

    invalidate() {}
}
