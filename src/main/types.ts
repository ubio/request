import { Response } from 'node-fetch';

export interface RequestHeaders {
    [key: string]: string | null | undefined;
}

export interface RequestOptions {
    body?: any;
    query?: { [key: string]: any };
    headers?: RequestHeaders;
}

export interface RequestConfig {
    baseUrl: string;
    auth?: RequestAuthorization;
    retryAttempts?: number;
    retryDelay?: number;
    headers?: RequestHeaders;
    jsonBody?: boolean;
    jsonResponse?: boolean;
    // mock fetch which can be used for testing
    fetchMock?(fullUrl: string, fetchOptions: any): Promise<Response>;
}

export interface RequestAuthorization {
    getHeader(requestOptions?: any): Promise<string | null>;
    retryConfig: AuthRetryConfig;
}

export interface AuthRetryConfig {
    attempts: number;
    delay: number;
    // The HTTP response status codes that will automatically be retried.
    // Defaults to: [[100, 199], [429, 429], [500, 599]]
    statusCodesToRetry: number[][];
    invalidate(): void;
}

export const DEFAULT_AUTH_RETRY_CONFIG: AuthRetryConfig = {
    attempts: 1,
    delay: 500,
    statusCodesToRetry: [[401, 401]],
    invalidate: () => {},
};

export const NETWORK_ERRORS = [
    'EAI_AGAIN',
    'EHOSTDOWN',
    'EHOSTUNREACH',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE'
];
