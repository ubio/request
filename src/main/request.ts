import querystring from 'querystring';
import fetch, { Response } from 'node-fetch';
import { Exception } from './exception';
import {
    RequestOptions,
    RequestConfig,
    RequestHeaders,
    NETWORK_ERRORS,
} from './types';

export class Request {
    config: RequestConfig;

    constructor(config: RequestConfig) {
        this.config = config;
    }

    async get(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendRequest('get', url, options);
    }

    async post(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendRequest('post', url, options);
    }

    async put(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendRequest('put', url, options);
    }

    async delete(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendRequest('delete', url, options);
    }

    async sendRequest(method: string, url: string, options: RequestOptions = {}): Promise<Response | any> {
        // Prepare body
        let body = options.body || null;
        const headers = options.headers || {};

        if (this.config.jsonBody && body) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(body);
        }

        const retryConfig = { attempts: 1, delay: 1000, ...this.config.auth?.retryConfig || {} };
        let attempted = 0;
        while (attempted < retryConfig.attempts) {
            attempted += 1;
            const res = await this.send(method, url, { ...options, headers, body });

            if (!res.ok) {
                if (this.shouldRetry(res.status)) {
                    await new Promise(r => setTimeout(r, retryConfig.delay || 1000));
                    continue;
                } else {
                    throw await this.createErrorFromResponse(method, url, res);
                }
            }

            if (res.status === 204) {
                // No response
                return null;
            }

            if (this.config.jsonResponse) {
                const json = await res.json();
                return json;
            }

            return res;
        }
    }

    async send(method: string, url: string, options: RequestOptions = {}): Promise<Response> {
        const { baseUrl, auth } = this.config;
        const headers = this.mergeHeaders(this.config.headers || {}, options.headers || {});
        // Prepare URL
        const qs = querystring.stringify(options.query || {});
        const fullUrl = baseUrl + url + (qs ? '?' + qs : '');

        const { body } = options;
        if (auth) {
            const authorization = await auth.getHeader({ url, method, body });
            headers.authorization = authorization || '';
        }
        // Send request
        return await this.fetchWithRetry(fullUrl, { method, headers, body });
    }

    async fetchWithRetry(fullUrl: string, fetchOptions: any): Promise<Response> {
        const { retryAttempts = 20, retryDelay = 1000, fetchMock } = this.config;
        let attempted = 0;
        let lastError = null;
        while (attempted < retryAttempts) {
            try {
                attempted += 1;
                if (fetchMock) {
                    return await fetchMock(fullUrl, fetchOptions);
                }
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

    shouldRetry(status: number): boolean {
        const { statusCodesToRetry } = this.config.auth?.retryConfig || {};
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
