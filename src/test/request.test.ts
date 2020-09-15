import assert from 'assert';
import {
    Request,
    BearerAuthAgent,
    fetchMock,
} from '../main';

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
                retryStatusCodes: [504],
            });

            try {
                await request.send('get', '/');
                throw new Error('UnexpectedSuccess');
            } catch (error) {
                assert.equal(error.details.status, 504);
                assert.equal(fetch.spy.called, true);
                assert.equal(fetch.spy.calledCount, retryAttempts + 1);
            }
        });

        it('tries once if request is successful on first attempt', async () => {
            const fetch = fetchMock({ status: 204 });
            const request = new Request({
                baseUrl: 'http://example.com',
                fetch,
                retryAttempts,
                retryDelay: 0,
                retryStatusCodes: [504],
            });

            await request.send('get', '/');
            assert.equal(fetch.spy.called, true);
            assert.equal(fetch.spy.calledCount, 1);
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
            } catch (error) {
                assert.equal(error.details.status, 400);
                assert.equal(fetch.spy.called, true);
                assert.equal(fetch.spy.calledCount, 1);

            }
        });

        it('emits retry event', async () => {
            let thrownError: any;
            const fetch = fetchMock({ status: 504 });
            const request = new Request({
                fetch,
                retryAttempts,
                retryDelay: 0,
                retryStatusCodes: [504],
            });
            request.on('retry', err => thrownError = err);
            await request.send('get', 'http://example.com').catch(() => {});
            assert.ok(thrownError);
            assert.equal(thrownError.details.status, 504);
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

        it('sets authorization by auth.getHeader when not present in options', async() => {
            await request.get('/hello');

            const { fetchOptions } = fetch.spy.params[0];
            assert.equal(fetchOptions?.headers?.authorization, 'Bearer token-says-hello');
        });

        it('overrides authorization when presents in options.headers', async () => {
            const headers = { authorization: 'Bearer new-token-that-overrides' };
            await request.get('/hello', { headers });
            const { fetchOptions } = fetch.spy.params[0];
            assert.equal(fetchOptions?.headers?.authorization, headers.authorization);
        });

        it('overrides config.headers when presents in options.headers', async () => {
            const headers = { 'custom-header': 'new-header-that-overrides' };
            await request.get('/hello', { headers });
            assert(fetch.spy.params[0]);

            const { fetchOptions } = fetch.spy.params[0]
            assert.equal(fetchOptions?.headers?.['custom-header'], headers['custom-header']);
        });
    });

    describe('invalidate auth', () => {

        it('invalidates auth once', async () => {
            let invalidated = false;
            const fetch = fetchMock({ status: 401 });
            const request = new Request({
                fetch,
                auth: {
                    async getHeader() {
                        return null;
                    },
                    invalidate() {
                        invalidated = true;
                    },
                },
                authInvalidateStatusCodes: [401],
            });
            try {
                await request.send('get', 'http://example.com');
                throw new Error('UnexpectedSuccess');
            } catch (error) {
                assert.equal(invalidated, true);
                assert.equal(error.details.status, 401);
                assert.equal(fetch.spy.called, true);
                assert.equal(fetch.spy.calledCount, 2);
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
                assert.strictEqual(fetch.spy.params[0].fullUrl, full)
            }
        });

        it('does not require baseUrl if url is absolute', async () => {
            const fetch = fetchMock({ status: 200 });

            const request = new Request({ fetch });
            await request.get('http://example.com/foo/bar');
            assert.strictEqual(fetch.spy.params[0].fullUrl, 'http://example.com/foo/bar')
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
    })
});
