import { Response, ResponseInit } from 'node-fetch';
import { FetchOptions } from '../types';

export class RequestMockFactory {
    spy: RequestMockSpy;

    constructor() {
        this.spy = {
            called: false,
            calledCount: 0,
            params: []
        };
    }

    getFetchFn(init?: ResponseInit, body: any = {}, error?: Error) {
        this.reset();

        return (fullUrl: string, fetchOptions: FetchOptions): Promise<Response> => {
            return new Promise((resolve, reject) => {
                const responseInit = { status: 200, ...init };
                this.spy.called = true;
                this.spy.calledCount += 1;
                this.spy.params.push({ fullUrl, fetchOptions });
                if (error) {
                    return reject(error);
                }

                const res = new Response(JSON.stringify(body), responseInit);
                resolve(res);
            });
        };
    }

    reset() {
        this.spy.called = false;
        this.spy.calledCount = 0;
        this.spy.params = [];
    }
}

export interface RequestMockSpy {
    called: boolean;
    calledCount: number;
    params: RequestMockSpyParams[];
}

export interface RequestMockSpyParams {
    fullUrl: string;
    fetchOptions: FetchOptions;
}
