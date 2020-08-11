import { Response } from 'node-fetch';
import { FetchMock } from './helpers';

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
    statusCodesToRetry: number[][];
    headers: RequestHeaders;
    fetch: Fetch | FetchMock,
}

export interface AuthAgent {
    getHeader(requestOptions?: any): Promise<string | null>;
    invalidate(): void;
}

export interface Fetch {
    (fullUrl: string, options: FetchOptions): Promise<Response>;
}
