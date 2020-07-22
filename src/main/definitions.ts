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
    fetchMock?(fullUrl: string, fetchOptions: any): Promise<Response>;
}

export interface RequestAuthorization {
    getHeader(requestOptions?: any): Promise<string | null>;
    retryCount?: number;
    retryDelay?: number;
    // The HTTP response status codes that will automatically be retried.
    // Defaults to: [[100, 199], [429, 429], [500, 599]]
    statusCodesToRetry?: number[][];
}

export const NETWORK_ERRORS = [
    'EAI_AGAIN',
    'EHOSTDOWN',
    'EHOSTUNREACH',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE'
];
