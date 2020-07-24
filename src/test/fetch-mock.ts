import { Response, ResponseInit } from 'node-fetch';
import { FetchOptions } from '../main';

export function testFetchFactory() {
    const spy = {
        called: false,
        calledCount: 0,
    };

    return {
        getMock: (init?: ResponseInit, body?: { [k: string]: any }, error?: Error) => {
            return (fullUrl: string, fetchOptions: FetchOptions): Promise<Response> => {
                return new Promise((resolve, reject) => {
                    const responseInit = { status: 200, ...init };
                    spy.called = true;
                    spy.calledCount += 1;
                    if (error) {
                        return reject(error);
                    }

                    const bodyInit = {
                        req: {
                            fullUrl,
                            fetchOptions,
                        },
                        body,
                    };

                    const res = new Response(JSON.stringify(bodyInit), responseInit);
                    resolve(res);
                });
            };
        },
        reset: () => {
            spy.called = false;
            spy.calledCount = 0;
        },
        spy,
    }
}
