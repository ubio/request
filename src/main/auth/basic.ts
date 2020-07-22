import { RequestAuthorization } from '../definitions';

export class Basic implements RequestAuthorization {
    username: string;
    password: string;

    constructor(params: BasicParams) {
        this.username = params.username || '';
        this.password = params.password || '';
    }

    async getHeader() {
        const header = `${this.username}:${this.password}`;
        const authString = Buffer.from(header, 'utf8').toString('base64');
        return `Basic ${authString}`;
    }
}

export interface BasicParams {
    username?: string;
    password?: string;
}
