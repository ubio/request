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

import { FetchOptions, Fetch } from '../types';

export function fetchMock(init?: ResponseInit, body: any = {}, error?: Error): FetchMock {
    const spy = {
        called: false,
        calledCount: 0,
        params: [] as FetchMockSpyParams[],
    };
    const fn = (fullUrl: string, fetchOptions: FetchOptions): Promise<Response> => {
        return new Promise((resolve, reject) => {
            const responseInit = { status: 200, ...init };
            spy.called = true;
            spy.calledCount += 1;
            spy.params.push({ fullUrl, fetchOptions });
            if (error) {
                return reject(error);
            }
            const res = new Response(JSON.stringify(body), responseInit);
            resolve(res);
        });
    };
    fn.spy = spy;
    return fn;
}

export type FetchMock = Fetch & FetchMockSpy;

export interface FetchMockSpy {
    spy: {
        called: boolean;
        calledCount: number;
        params: FetchMockSpyParams[];
    }
}

export interface FetchMockSpyParams {
    fullUrl: string;
    fetchOptions: FetchOptions;
}
