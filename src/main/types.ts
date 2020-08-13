import { Response } from 'node-fetch';

export interface RequestHeaders {
    [key: string]: string;
}

export interface RequestOptions {
    body?: any;
    query?: { [key: string]: any };
    headers?: RequestHeaders;
}

export interface FetchOptions {
    method?: string;
    body?: any;
    headers?: RequestHeaders;
}

export interface RequestConfig {
    baseUrl: string;
    auth: AuthAgent;
    retryAttempts: number;
    retryDelay: number;
    statusCodesToRetry: StatusCodeRanges;
    statusCodeToInvalidateAuth: StatusCodeRanges;
    headers: RequestHeaders;
    fetch: Fetch;
    onError: (err: Error, info: RequestErrorInfo) => void | Promise<void>;
    onRetry: (err: Error, info: RequestErrorInfo) => void | Promise<void>;
}

export type StatusCodeRanges = Array<number | [number, number]>;

export interface AuthAgent {
    getHeader(requestOptions?: any): Promise<string | null>;
    invalidate(): void;
}

export interface Fetch {
    (fullUrl: string, options: FetchOptions): Promise<Response>;
}

export interface RequestErrorInfo {
    method: string;
    url: string;
    headers: RequestHeaders;
    status?: number;
    statusText?: number;
}
