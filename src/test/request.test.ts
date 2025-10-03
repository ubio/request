import assert from 'assert';

import {
    BearerAuthAgent,
    fetchMock,
    Request,
} from '../main';
import { AuthAgent } from '../main/auth-agent';

describe('Request', () => {
    describe('retry', () => {
        const retryAttempts = 3;

        it('retries specified times', async () => {
            const fetch = fetchMock({ status: 504 });
            const request = new Request({
                baseUrl: 'http://example.com',
                fetch,
                retryAttempts,
                retryDelay: 0,
                retryDelayIncrement: 10,
                retryStatusCodes: [504],
            });

            try {
                await request.send('get', '/');
                throw new Error('UnexpectedSuccess');
            } catch (error: any) {
                assert.strictEqual(error.details.status, 504);
                assert.strictEqual(fetch.spy.called, true);
                assert.strictEqual(fetch.spy.calledCount, retryAttempts + 1);
            }
        });

        it('tries once if request is successful on first attempt', async () => {
            const fetch = fetchMock({ status: 201 });
            const request = new Request({
                baseUrl: 'http://example.com',
                fetch,
                retryAttempts,
                retryDelay: 0,
                retryStatusCodes: [504],
            });

            await request.send('get', '/');
            assert.strictEqual(fetch.spy.called, true);
            assert.strictEqual(fetch.spy.calledCount, 1);
        });

        it('tries once when status code is not in statusCodesToRetry range', async () => {
            const fetch = fetchMock({ status: 400 });
            const request = new Request({
                baseUrl: 'http://example.com',
                fetch,
                retryAttempts,
                retryDelay: 0,
                retryStatusCodes: [504],
            });

            try {
                await request.send('get', '/');
                throw new Error('UnexpectedSuccess');
            } catch (error: any) {
                assert.strictEqual(error.details.status, 400);
                assert.strictEqual(fetch.spy.called, true);
                assert.strictEqual(fetch.spy.calledCount, 1);

            }
        });

        it('invokes onRetry', async () => {
            let thrownError: any;
            const fetch = fetchMock({ status: 504 });
            const request = new Request({
                fetch,
                retryAttempts,
                retryDelay: 0,
                retryDelayIncrement: 10,
                retryStatusCodes: [504],
            });
            request.onRetry = err => { thrownError = err; };
            await request.send('get', 'http://example.com').catch(() => {});
            assert.ok(thrownError);
            assert.strictEqual(thrownError.details.status, 504);
        });

        it('retry if handleShouldRetry returns true', async () => {
            let thrownError: any;
            const fetch = fetchMock({ status: 500 });
            const request = new Request({
                fetch,
                retryAttempts,
                retryDelay: 0,
                retryDelayIncrement: 10,
                handleShouldRetry: err => {
                    err.message = 'should-retry';
                    return true;
                },
            });
            request.onRetry = err => { thrownError = err; };
            await request.send('get', 'http://example.com').catch(() => {});
            assert.ok(thrownError);
            assert.strictEqual(thrownError.message, 'should-retry');
            assert.strictEqual(thrownError.details.status, 500);
        });

        it('do not retry by default config', async () => {
            let retried = false;
            const fetch = fetchMock({ status: 500 });
            const request = new Request({
                fetch
            });
            request.onRetry = () => { retried = true; };
            await request.send('get', 'http://example.com').catch(() => {});
            assert.ok(!retried);
        });

    });

    describe('mergeHeaders', () => {
        let request: Request;
        let fetch: any;

        beforeEach(async () => {
            const auth = new BearerAuthAgent({ token: 'token-says-hello' });
            fetch = fetchMock({ status: 200 });
            request = new Request({
                baseUrl: 'http://example.com',
                headers: { 'custom-header': 'hello-there' },
                auth,
                fetch,
            });
        });

        it('sets authorization by auth.getHeader when not present in options', async () => {
            await request.get('/hello');

            const { fetchOptions } = fetch.spy.params[0];
            assert.strictEqual(fetchOptions?.headers?.authorization, 'Bearer token-says-hello');
        });

        it('overrides authorization when presents in options.headers', async () => {
            const headers = { authorization: 'Bearer new-token-that-overrides' };
            await request.get('/hello', { headers });
            const { fetchOptions } = fetch.spy.params[0];
            assert.strictEqual(fetchOptions?.headers?.authorization, headers.authorization);
        });

        it('overrides config.headers when presents in options.headers', async () => {
            const headers = { 'custom-header': 'new-header-that-overrides' };
            await request.get('/hello', { headers });
            assert(fetch.spy.params[0]);

            const { fetchOptions } = fetch.spy.params[0];
            assert.strictEqual(fetchOptions?.headers?.['custom-header'], headers['custom-header']);
        });
    });

    describe('invalidate auth', () => {

        it('invalidates auth when specified status code is returned', async () => {
            let invalidated = false;
            const fetch = fetchMock({ status: 401 });
            const auth = new (class extends AuthAgent {
                async getHeader() { return null; }
                invalidate() { invalidated = true; }
            })();
            const request = new Request({
                fetch,
                auth,
                authInvalidateStatusCodes: [401],
            });
            try {
                await request.send('get', 'http://example.com');
                throw new Error('UnexpectedSuccess');
            } catch (error: any) {
                assert.strictEqual(invalidated, true);
                assert.strictEqual(error.details.status, 401);
                assert.strictEqual(fetch.spy.called, true);
            }
        });

    });

    describe('URL formatting', () => {
        it('concatenates baseUrl with url as expected', async () => {
            const fetch = fetchMock({ status: 200 });

            const expectations = [
                ['http://example.com:123/foo/bar', 'baz', 'http://example.com:123/foo/bar/baz'],
                ['http://example.com:123/foo/bar', '/baz', 'http://example.com:123/foo/bar/baz'],
                ['http://example.com:123/foo/bar/', 'baz', 'http://example.com:123/foo/bar/baz'],
                ['http://example.com:123/foo/bar/', '/baz', 'http://example.com:123/foo/bar/baz'],
            ];

            for (const [base, url, full] of expectations) {
                const request = new Request({ fetch, baseUrl: base });
                await request.get(url);
                assert.strictEqual(fetch.spy.params[0].fullUrl, full);
            }
        });

        it('does not require baseUrl if url is absolute', async () => {
            const fetch = fetchMock({ status: 200 });

            const request = new Request({ fetch });
            await request.get('http://example.com/foo/bar');
            assert.strictEqual(fetch.spy.params[0].fullUrl, 'http://example.com/foo/bar');
        });

        it('throws on attempt to use invalid URL', async () => {
            const fetch = fetchMock({ status: 200 });


            try {
                const request = new Request({ fetch });
                await request.get('/foo/bar');
                throw new Error('UnexpectedSuccess');
            } catch (error) {
                assert.strictEqual(fetch.spy.called, false);
            }
        });
    });

    describe('onError', () => {
        it('emits error event', async () => {
            let called = false;
            let thrownError: any;
            let info: any;
            const fetch = fetchMock({ status: 500 });
            const request = new Request({
                fetch,
                retryAttempts: 0,
                retryDelay: 0,
            });
            request.onError = (err, debugInfo) => {
                called = true;
                thrownError = err;
                info = debugInfo;
            };
            await request.send('get', 'http://example.com').catch(() => {});
            assert.ok(called);
            assert.strictEqual(thrownError?.details.status, 500);
            assert.strictEqual(info?.status, 500);
        });
    });
});
