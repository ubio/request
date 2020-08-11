import assert from 'assert';
import {
    Request,
    BearerAuthAgent,
    fetchMock,
} from '../main';

describe('Request', () => {
    describe('retry', () => {

        context('config.retryAttempts = 3', () => {
            const retryAttempts = 3;

            it('tries 3 times when status satisfies the range', async () => {
                const fetch = fetchMock({ status: 401 });
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch,
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                try {
                    await request.send('get', '/');
                } catch (error) {
                    assert.equal(error.details.status, 401);
                    assert.equal(fetch.spy.called, true);
                    assert.equal(fetch.spy.calledCount, retryAttempts);
                    return;
                }
                assert(false, 'unexpected success');

            });

            it('tries once if request is successful on first attempt', async () => {
                const fetch = fetchMock({ status: 204 });
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch,
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                await request.send('get', '/');
                assert.equal(fetch.spy.called, true);
                assert.equal(fetch.spy.calledCount, 1);
            });

            it('tries once when status code is not in statusCodesToRetry range', async () => {
                const fetch = fetchMock({ status: 500 });
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch,
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                try {
                    await request.send('get', '/');
                } catch (error) {
                    assert.equal(error.details.status, 500);
                    assert.equal(fetch.spy.called, true);
                    assert.equal(fetch.spy.calledCount, 1);

                    return;
                }

                assert(false, 'unexpected success');
            });
        });

    });

    describe('mergeHeaders', () => {
        let request: Request;
        let fetch: any;

        beforeEach(async () => {
            const auth = new BearerAuthAgent({ token: 'token-says-hello' });
            fetch = fetchMock({ status: 200 });
            request = new Request({
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

});
