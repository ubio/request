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
    RequestSpec,
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
    'EPIPE',
    // ERR_INTERNET_DISCONNECTED
];

// TODO introduce logger
export const DEFAULT_REQUEST_CONFIG: RequestConfig = {
    baseUrl: '',
    auth: new NoAuthAgent(),
    retryAttempts: 4,
    retryDelay: 500,
    retryDelayIncrement: 500,
    retryStatusCodes: [429, 502, 503, 504],
    authInvalidateStatusCodes: [401, 403],
    headers: {},
    fetch,
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

    // TODO simplify
    async send(method: string, url: string, options: RequestOptions = {}): Promise<Response> {
        const { fetch } = this.config;
        const totalAttempts = Math.max(this.config.retryAttempts + 1, 1);
        let lastError;
        let lastInfo: RequestDebugInfo;
        for (let i = 0; i < totalAttempts; i++) {
            let shouldRetry = false;
            let retryDelay = this.config.retryDelay + this.config.retryDelayIncrement * i;
            try {
                const spec = await this.prepareRequestSpec(method, url, options);
                const res = await fetch(spec.url, {
                    method: spec.method,
                    headers: spec.headers,
                    body: spec.body,
                });
                if (!res.ok) {
                    const invalidateAuth = this.config.authInvalidateStatusCodes.includes(res.status);
                    if (invalidateAuth) {
                        // Note: we only retry once, if auth was authenticated
                        shouldRetry = true;
                        retryDelay = 0;
                        this.config.auth.invalidate();
                    } else {
                        shouldRetry = this.config.retryStatusCodes.includes(res.status);
                    }
                    throw await this.createErrorFromResponse(spec, res);
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
                    throw err;
                }
            }
        }
        this.onError(lastError, lastInfo!);
        throw lastError;
    }

    async sendRaw(method: string, url: string, options: RequestOptions = {}) {
        const spec = await this.prepareRequestSpec(method, url, options);
        const { fetch } = this.config;
        return await fetch(spec.url, {
            method: spec.method,
            headers: spec.headers,
            body: spec.body,
        });
    }

    protected async prepareRequestSpec(
        method: string,
        url: string,
        options: RequestOptions = {},
    ): Promise<RequestSpec> {
        const { auth } = this.config;
        const { body } = options;
        const fullUrl = this.prepareUrl(url, options);
        const authorization = await auth.getHeader({ url: fullUrl, method, body }) ?? '';
        const headers = this.mergeHeaders(
            { 'content-type': this.inferContentTypeFromBody(body) ?? '' },
            this.config.headers || {},
            { authorization },
            options.headers || {});
        return {
            method,
            url: fullUrl,
            headers,
            body,
        };
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

    protected async createErrorFromResponse(requestSpec: RequestSpec, res: Response): Promise<Error> {
        return new RequestFailedError(requestSpec, res);
    }

    // TODO remove, replace with logging
    onRetry(_error: Error, _info: RequestDebugInfo) {}
    onError(_error: Error, _info: RequestDebugInfo) {}
}

export class RequestFailedError extends Exception {
    response!: Response;

    constructor(
        requestSpec: RequestSpec,
        response: Response,
    ) {
        super(`Request failed: ${response.status} ${response.statusText}`);
        this.details = {
            method: requestSpec.method,
            url: requestSpec.url,
            requestHeaders: requestSpec.headers,
            status: response.status,
            statusText: response.statusText,
        };
        // Attach non-enumerable details to prevent accidental serialization
        Object.defineProperty(this, 'requestSpec', {
            enumerable: false,
            value: requestSpec,
        });
        Object.defineProperty(this, 'response', {
            enumerable: false,
            value: response,
        });
    }

}
