import assert from 'assert';
import { testFetchFactory } from './fetch-mock';
import { Request } from '../main/request';

describe('Request', () => {
    describe('retry', () => {
        const testFetch = testFetchFactory();
        beforeEach(() => {
            testFetch.reset();
        });

        context('config.retryAttempts = 3', () => {
            const retryAttempts = 3;

            it('tries 3 times when status satisfies the range', async () => {
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch: testFetch.getMock({ status: 401 }),
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                const res = await request.send('get', '/');
                assert.equal(res.status, 401);
                assert.equal(testFetch.spy.called, true);
                assert.equal(testFetch.spy.calledCount, retryAttempts);
            });

            it('tries once if request is successful on first attempt', async () => {
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch: testFetch.getMock({ status: 204 }),
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                await request.send('get', '/');
                assert.equal(testFetch.spy.called, true);
                assert.equal(testFetch.spy.calledCount, 1);
            });

            it('tries once when status code is not in statusCodesToRetry range', async () => {
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch: testFetch.getMock({ status: 500 }),
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                const res = await request.send('get', '/');
                assert.equal(res.status, 500);
                assert.equal(testFetch.spy.called, true);
                assert.equal(testFetch.spy.calledCount, 1);
            });
        });

    });
});
