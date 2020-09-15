import nodeFetch, { Response } from 'node-fetch';
import { Exception } from './exception';
import {
    RequestOptions,
    RequestConfig,
    RequestHeaders,
} from './types';
import { NoAuthAgent } from './auth-agents';
import { filterUndefined } from './util/filter-undefined';
import EventEmitter from 'eventemitter3';

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
    retryStatusCodes: [429, 500, 502, 503, 504],
    authInvalidateStatusCodes: [401, 403],
    authInvalidateInterval: 60000,
    headers: {},
    fetch: nodeFetch,
};

export class Request extends EventEmitter {
    config: RequestConfig;
    authInvalidatedAt: number = 0;

    constructor(options: Partial<RequestConfig>) {
        super();
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
        if (status === 204 || res.headers.get('content-length') === '0') {
            // No response
            return null;
        }
        const json = await res.json();
        return json;
    }

    async send(method: string, url: string, options: RequestOptions = {}): Promise<Response> {
        const totalAttempts = Math.max(this.config.retryAttempts + 1, 1);
        let attempted = 0;
        let lastError;
        while (attempted < totalAttempts) {
            attempted += 1;
            let shouldRetry = false;
            let retryDelay = this.config.retryDelay;
            try {
                const res = await this.sendRaw(method, url, options);
                if (!res.ok) {
                    const invalidateAuth = this.config.authInvalidateStatusCodes.includes(res.status);
                    if (invalidateAuth) {
                        // Note: we only retry once, if auth was authenticated
                        shouldRetry = (Date.now() - this.authInvalidatedAt) > this.config.authInvalidateInterval;
                        this.authInvalidatedAt = Date.now();
                        retryDelay = 0;
                        this.config.auth.invalidate();
                    } else {
                        shouldRetry = this.config.retryStatusCodes.includes(res.status);
                    }
                    throw await this.createErrorFromResponse(method, url, res, attempted);
                }
                return res;
            } catch (err) {
                const status = err.res?.status;
                const statusText = err.res?.statusText;
                const info = { method, url, headers: options.headers ?? {}, status, statusText };
                const retry = shouldRetry || NETWORK_ERRORS.includes(err.code);
                if (retry) {
                    lastError = err;
                    this.emit('retry', err, info);
                    await new Promise(r => setTimeout(r, retryDelay));
                    continue;
                } else {
                    this.emit('error', err, info);
                    throw err;
                }
            }
        }
        throw lastError;
    }

    async sendRaw(method: string, url: string, options: RequestOptions = {}) {
        const { baseUrl, auth } = this.config;
        const base = (baseUrl && baseUrl.slice(-1) !== '/') ? `${baseUrl}/` : baseUrl;
        const fullUrl = new URL(url[0] === '/' ? url.slice(1) : url, base || undefined);
        fullUrl.search = new URLSearchParams(Object.entries(options.query || {})).toString();
        const { body } = options;

        const authorization = await auth.getHeader({ url: fullUrl.toString(), method, body }) ?? '';
        const headers = this.mergeHeaders(this.config.headers || {}, { authorization }, options.headers || {});

        const { fetch } = this.config;
        this.emit('beforeSend', { method, url, headers });
        return await fetch(fullUrl.toString(), { method, headers, body });
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
                status: res.status,
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
