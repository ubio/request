// Copyright 2020 UBIO Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Exception } from './exception';
import {
    RequestOptions,
    RequestConfig,
    RequestHeaders,
    RequestDebugInfo,
} from './types';
import { NoAuthAgent } from './auth-agents';
import fetch from './fetch';

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
    fetch,
};

export class Request {
    config: RequestConfig;
    authInvalidatedAt: number = 0;

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
                'content-type': 'application/json',
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
        let lastInfo: RequestDebugInfo;
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
                const status = err.details?.status;
                const statusText = err.details?.statusText;
                const info: RequestDebugInfo = { method, url, headers: options.headers ?? {}, status, statusText };
                const retry = shouldRetry || NETWORK_ERRORS.includes(err.code);
                if (retry) {
                    lastError = err;
                    lastInfo = info;
                    this.onRetry(err, info);
                    await new Promise(r => setTimeout(r, retryDelay));
                    continue;
                } else {
                    this.onError(err, info);
                }
            }
        }
        this.onError(lastError, lastInfo!);
    }

    async sendRaw(method: string, url: string, options: RequestOptions = {}) {
        const { auth, fetch } = this.config;
        const { body } = options;
        const fullUrl = this.prepareUrl(url, options);
        const authorization = await auth.getHeader({ url: fullUrl, method, body }) ?? '';
        const headers = this.mergeHeaders(
            { 'content-type': this.inferContentTypeFromBody(body) ?? '' },
            this.config.headers || {},
            { authorization },
            options.headers || {});
        return await fetch(fullUrl, { method, headers, body });
    }

    protected prepareUrl(url: string, options: RequestOptions): string {
        const { baseUrl } = this.config;
        const base = (baseUrl && baseUrl.slice(-1) !== '/') ? `${baseUrl}/` : baseUrl;
        const parsedUrl = new URL(url[0] === '/' ? url.slice(1) : url, base || undefined);
        parsedUrl.search = new URLSearchParams(Object.entries(options.query ?? {})).toString();
        return parsedUrl.toString();
    }

    protected inferContentTypeFromBody(body: any): string | null {
        switch (true) {
            case body == null: return null;
            case body instanceof URLSearchParams: return 'application/x-www-form-urlencoded';
            case typeof body === 'object': return 'application/json';
            case typeof body === 'string': return 'text/plain';
            default: return null;
        }
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
        throw new Exception({
            name: 'RequestFailed',
            message: `Request with ${res.status} ${res.statusText}`,
            details: {
                method,
                url,
                status: res.status,
                statusText: res.statusText,
                responseHeaders: res.headers,
                responseText: await res.text().catch(err => ({ ...err })),
                attempts,
            }
        });
    }

    onRetry(_error: Error, _info: RequestDebugInfo) {}

    onError(error: Error, _info: RequestDebugInfo): never {
        throw error;
    }

}
