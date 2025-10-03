import { AuthAgent } from './auth-agent';

export interface RequestHeaders {
    [key: string]: string;
}

export interface RequestOptions {
    body?: any;
    query?: { [key: string]: any };
    headers?: RequestHeaders;
}

export type RequestSpec = { method: string; url: string } & RequestOptions;

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
    retryDelayIncrement: number;
    retryStatusCodes: number[];
    authInvalidateStatusCodes: number[];
    headers: RequestHeaders;
    fetch: Fetch;
    handleShouldRetry?: (error: Error) => boolean;
}

export interface Fetch {
    (fullUrl: string, options: FetchOptions): Promise<Response>;
}

export interface RequestDebugInfo {
    method: string;
    url: string;
    headers: RequestHeaders;
    status?: number;
    statusText?: number;
}
