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

export interface RequestDebugInfo {
    method: string;
    url: string;
    headers: RequestHeaders;
    status?: number;
    statusText?: number;
}
