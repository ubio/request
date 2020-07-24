import assert from 'assert';
import { testFetchFactory } from './fetch-mock';
import { Request } from '../main/request';
import { BearerAuthAgent } from '../main';
const testFetch = testFetchFactory();

describe('Request', () => {
    describe('retry', () => {
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

    describe('mergeHeaders', () => {
        let request: Request;
        beforeEach(async () => {
            const auth = new BearerAuthAgent({ token: 'token-says-hello' });
            request = new Request({
                headers: { 'custom-header': 'hello-there' },
                auth,
                fetch: testFetch.getMock({ status: 200 }),
            });
        });

        it('sets authorization by auth.getHeader when not present in options', async() => {
            const { req } = await request.get('/hello');
            assert(req.fetchOptions);

            const { fetchOptions } = req;
            assert.equal(fetchOptions?.headers?.authorization, 'Bearer token-says-hello');
        });

        it('overrides authorization when presents in options.headers', async () => {
            const headers = { authorization: 'Bearer new-token-that-overrides' };
            const { req } = await request.get('/hello', { headers });
            assert(req.fetchOptions);

            const { fetchOptions } = req;
            assert.equal(fetchOptions?.headers?.authorization, headers.authorization);
        });

        it('overrides config.headers when presents in options.headers', async () => {
            const headers = { 'custom-header': 'new-header-that-overrides' };
            const { req } = await request.get('/hello', { headers });
            assert(req.fetchOptions);

            const { fetchOptions } = req;
            assert.equal(fetchOptions.headers['custom-header'], headers['custom-header']);
        });
    });

});
