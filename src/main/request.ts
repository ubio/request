import nodeFetch, { Response } from 'node-fetch';
import { Exception } from './exception';
import {
    RequestOptions,
    RequestConfig,
    RequestHeaders,
    StatusCodeRanges,
} from './types';
import { NoAuthAgent } from './auth-agents';
import { filterUndefined } from './helpers/filter-undefined';

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
    statusCodesToRetry: [401, 429, [502, 503]],
    statusCodeToInvalidateAuth: [401, 403],
    headers: {},
    fetch: nodeFetch,
    onRetry: () => {},
};

export class Request {
    config: RequestConfig;

    constructor(options: Partial<RequestConfig>) {
        this.config = {
            ...DEFAULT_REQUEST_CONFIG,
            ...filterUndefined(options),
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
            let shouldRetry = false;
            attempted += 1;
            try {
                const res = await this.sendRaw(method, url, options);
                if (!res.ok) {
                    const invalidateAuth = this.matchStatusRange(res.status, this.config.statusCodeToInvalidateAuth);
                    if (invalidateAuth) {
                        this.config.auth.invalidate();
                    }
                    shouldRetry = this.matchStatusRange(res.status, this.config.statusCodesToRetry);
                    throw await this.createErrorFromResponse(method, url, res, attempted);
                }
                return res;
            } catch (err) {
                const retry = shouldRetry || NETWORK_ERRORS.includes(err.code);
                if (retry) {
                    lastError = err;
                    this.config.onRetry(err);
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
        // Prepare URL
        const qs = new URLSearchParams(Object.entries(options.query || {})).toString();
        const fullUrl = baseUrl + url + (qs ? '?' + qs : '');
        const { body } = options;
        // Prepare auth & headers
        const authorization = await auth.getHeader({ url: fullUrl, method, body }) ?? '';
        const headers = this.mergeHeaders(this.config.headers || {}, { authorization }, options.headers || {});
        // Send request
        const { fetch } = this.config;
        return await fetch(fullUrl, { method, headers, body });
    }

    protected matchStatusRange(status: number, ranges: StatusCodeRanges): boolean {
        for (const range of ranges) {
            const match = typeof range === 'number' ? status === range :
                range[0] <= status && status <= range[1];
            if (match) {
                return true;
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
