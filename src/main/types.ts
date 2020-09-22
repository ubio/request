import { AuthAgent } from './auth-agent';

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
    retryStatusCodes: number[];
    authInvalidateStatusCodes: number[];
    authInvalidateInterval: number;
    headers: RequestHeaders;
    fetch: Fetch;
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
