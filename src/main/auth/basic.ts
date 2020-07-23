import { RequestAuthorization, AuthRetryConfig, DEFAULT_AUTH_RETRY_CONFIG } from '../types';

export class Basic implements RequestAuthorization {
    params: BasicParams;
    retryConfig: AuthRetryConfig;
    constructor(params: BasicParams, retryConfig?: Partial<AuthRetryConfig>) {
        this.params = params;
        this.retryConfig = { ...DEFAULT_AUTH_RETRY_CONFIG, ...retryConfig };
    }

    async getHeader() {
        const { username, password } = this.params;
        const header = `${username}:${password}`;
        const authString = Buffer.from(header, 'utf8').toString('base64');
        return `Basic ${authString}`;
    }
}

export interface BasicParams {
    username?: string;
    password?: string;
}
