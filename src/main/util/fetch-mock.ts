import { FetchOptions, Fetch } from '../types';
import Response from '../response';

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
