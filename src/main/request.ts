import nodeFetch, { Response } from 'node-fetch';
import { Exception } from './exception';
import {
    RequestOptions,
    RequestConfig,
    RequestHeaders,
    FetchOptions,
} from './types';
import { NoAuthAgent } from './auth';

export const NETWORK_ERRORS = [
    'EAI_AGAIN',
    'EHOSTDOWN',
    'EHOSTUNREACH',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE'
];

export const DEFAULT_REQUEST_CONFIG: RequestConfig = {
    baseUrl: '',
    auth: new NoAuthAgent(),
    retryAttempts: 10,
    retryDelay: 500,
    statusCodesToRetry: [[401, 401], [429, 429], [500, 599]],
    headers: {},
    fetch: nodeFetch,
};

export class Request {
    config: RequestConfig;

    constructor(options: Partial<RequestConfig>) {
        this.config = {
            ...DEFAULT_REQUEST_CONFIG,
            ...options,
        };
    }

    async get(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('get', url, options);
    }

    async post(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('post', url, options);
    }

    async put(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('put', url, options);
    }

    async delete(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('delete', url, options);
    }

    async sendJson(method: string, url: string, options: RequestOptions = {}): Promise<any> {
        const { body, query, headers } = options;
        const res = await this.sendWithRetry(method, url, {
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            query,
            body: body ? JSON.stringify(body) : '',
        });
        const { status } = res;
        if (status === 204) {
            // No response
            return null;
        }
        if (!res.ok) {
            throw await this.createErrorFromResponse(method, url, res);
        }
        const json = await res.json();
        return json;
    }

    async send(method: string, url: string, options: RequestOptions = {}): Promise<Response> {
        return this.sendWithRetry(method, url, options);
    }

    protected async sendWithRetry(method: string, url: string, options: RequestOptions = {}): Promise<Response> {
        const { retryAttempts, retryDelay } = this.config;
        let attempted = 0;
        let lastError;
        while (attempted < retryAttempts) {
            attempted += 1;
            const res = await this._send(method, url, options);
            if (!res.ok) {
                if (this.shouldRetry(res.status)) {
                    this.config.auth.invalidate();
                    await new Promise(r => setTimeout(r, retryDelay));
                    continue;
                } else {
                    lastError = this.createErrorFromResponse(method, url, res);
                }
            }
            return res;
        }

        throw lastError;
    }

    protected async _send(method: string, url: string, options: RequestOptions = {}) {
        const { baseUrl, auth } = this.config;
        const { body } = options;
        const authorization = await auth.getHeader({ url, method, body }) ?? '';
        const headers = this.mergeHeaders(this.config.headers || {}, { authorization }, options.headers || {});
        // Prepare URL
        const qs = new URLSearchParams(Object.entries(options.query || {})).toString();
        const fullUrl = baseUrl + url + (qs ? '?' + qs : '');
        // Send request
        return await this.fetchWithRetry(fullUrl, { method, headers, body });
    }

    protected async fetchWithRetry(fullUrl: string, fetchOptions: FetchOptions): Promise<Response> {
        const { retryAttempts, retryDelay } = this.config;
        let attempted = 0;
        let lastError = null;
        while (attempted < retryAttempts) {
            try {
                attempted += 1;
                const { fetch } = this.config;
                return await fetch(fullUrl, fetchOptions);
            } catch (e) {
                if (NETWORK_ERRORS.includes(e.code)) {
                    lastError = e;
                    await new Promise(r => setTimeout(r, retryDelay));
                } else {
                    throw e;
                }
            }
        }
        throw lastError;
    }

    protected shouldRetry(status: number): boolean {
        const { statusCodesToRetry } = this.config;
        if (statusCodesToRetry) {
            for (const range of statusCodesToRetry) {
                if (range[0] <= status && status <= range[1]) {
                    return true;
                }
            }
        }
        return false;
    }

    protected mergeHeaders(...headers: RequestHeaders[]) {
        const result: { [key: string]: string } = {};
        for (const hdrs of headers) {
            for (const [k, v] of Object.entries(hdrs)) {
                if (!v) {
                    continue;
                }
                result[k.toLowerCase()] = v;
            }
        }
        return result;
    }

    protected async createErrorFromResponse(
        method: string,
        url: string,
        res: Response,
    ): Promise<Error> {
        const responseText = await res.text();
        try {
            const json = JSON.parse(responseText);
            return new Exception({
                name: json.name,
                message: json.message,
                details: json.details,
            });
        } catch (err) {
            return new Exception({
                name: 'InternalError',
                message: 'The request cannot be processed',
                details: {
                    method,
                    url,
                    fullUrl: res.url,
                    status: res.status,
                    cause: err,
                }
            });
        }
    }

}
