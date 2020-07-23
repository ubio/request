import { Response, ResponseInit } from 'node-fetch';

export function testFetchFactory() {
    const spy = {
        called: false,
        calledCount: 0,
    };

    return {
        getMock: (options?: ResponseInit, body?: any, error?: Error) => {
            return (): Promise<Response> => {
                return new Promise((resolve, reject) => {
                    const responseInit = { status: 204, ...options };
                    spy.called = true;
                    spy.calledCount += 1;
                    if (error) {
                        return reject(error);
                    }
                    let bodyInit: any = '';
                    if (body) {
                        bodyInit = JSON.stringify(body);
                    }

                    const res = new Response(bodyInit, responseInit);
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
