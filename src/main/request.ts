import nodeFetch, { Response } from 'node-fetch';
import { Exception } from './exception';
import {
    RequestOptions,
    RequestConfig,
    RequestHeaders,
} from './types';
import { NoAuthAgent } from './auth-agents';

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
    statusCodesToRetry: [[401, 401], [429, 429], [502, 503]],
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
        const res = await this.send(method, url, {
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            query,
            body: body ? JSON.stringify(body) : null,
        });
        const { status } = res;
        if (status === 204) {
            // No response
            return null;
        }
        const json = await res.json();
        return json;
    }

    async send(method: string, url: string, options: RequestOptions = {}): Promise<Response> {
        const { retryAttempts, retryDelay } = this.config;
        let attempted = 0;
        let lastError;
        while (attempted < retryAttempts) {
            attempted += 1;
            try {
                const res = await this.sendRaw(method, url, options);
                if (!res.ok) {
                    lastError = await this.createErrorFromResponse(method, url, res, attempted);
                    if (this.shouldRetry(res.status)) {
                        this.config.auth.invalidate();
                        await new Promise(r => setTimeout(r, retryDelay));
                        continue;
                    }
                    break;
                }
                return res;
            } catch (err) {
                if (NETWORK_ERRORS.includes(err.code)) {
                    lastError = err;
                    await new Promise(r => setTimeout(r, retryDelay));
                    continue;
                } else {
                    throw err;
                }
            }
        }
        throw lastError;
    }

    async sendRaw(method: string, url: string, options: RequestOptions = {}) {
        const { baseUrl, auth } = this.config;
        const qs = new URLSearchParams(Object.entries(options.query || {})).toString();
        const fullUrl = baseUrl + url + (qs ? '?' + qs : '');
        const { body } = options;

        const authorization = await auth.getHeader({ url: fullUrl, method, body }) ?? '';
        const headers = this.mergeHeaders(this.config.headers || {}, { authorization }, options.headers || {});
        // Prepare URL
        // Send request
        const { fetch } = this.config;
        return await fetch(fullUrl, { method, headers, body });
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
        attempts: number = 1,
    ): Promise<Error> {
        const responseText = await res.text();
        const details = {
            method,
            url,
            fullUrl: res.url,
            status: res.status,
            attempts,
        };
        try {
            const json = JSON.parse(responseText);
            const exception = new Exception({
                name: json.name || res.statusText,
                message: json.message,
                details: {
                    ...details,
                    ...json ?? {},
                },
            });
            Object.defineProperty(exception, 'response', {
                value: res,
                enumerable: false,
            });
            return exception;
        } catch (err) {
            const exception = new Exception({
                name: 'RequestFailed',
                message: `Request ${method} ${url} failed with ${res.status} ${res.statusText}`,
                details: {
                    ...details,
                    cause: err,
                }
            });
            Object.defineProperty(exception, 'response', {
                value: res,
                enumerable: false,
            });
            return exception;
        }
    }

}
