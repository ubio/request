import assert from 'assert';
import {
    Request,
    BearerAuthAgent,
    RequestMockFactory,
} from '../main';

const mock = new RequestMockFactory();
describe('Request', () => {
    describe('retry', () => {
        beforeEach(() => {
            mock.reset();
        });

        context('config.retryAttempts = 3', () => {
            const retryAttempts = 3;

            it('tries 3 times when status satisfies the range', async () => {
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch: mock.getFetchFn({ status: 401 }),
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                try {
                    await request.send('get', '/');
                } catch (error) {
                    assert.equal(error.details.status, 401);
                    assert.equal(mock.spy.called, true);
                    assert.equal(mock.spy.calledCount, retryAttempts);
                    return;
                }
                assert(false, 'unexpected success');

            });

            it('tries once if request is successful on first attempt', async () => {
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch: mock.getFetchFn({ status: 204 }),
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                await request.send('get', '/');
                assert.equal(mock.spy.called, true);
                assert.equal(mock.spy.calledCount, 1);
            });

            it('tries once when status code is not in statusCodesToRetry range', async () => {
                const request = new Request({
                    baseUrl: 'http://example.com',
                    fetch: mock.getFetchFn({ status: 500 }),
                    retryAttempts,
                    retryDelay: 0,
                    statusCodesToRetry: [[401, 401]],
                });

                try {
                    await request.send('get', '/');
                } catch (error) {
                    assert.equal(error.details.status, 500);
                    assert.equal(mock.spy.called, true);
                    assert.equal(mock.spy.calledCount, 1);

                    return;
                }

                assert(false, 'unexpected success');
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
                fetch: mock.getFetchFn({ status: 200 }),
            });
        });

        it('sets authorization by auth.getHeader when not present in options', async() => {
            await request.get('/hello');

            const { fetchOptions } = mock.spy.params[0];
            assert.equal(fetchOptions?.headers?.authorization, 'Bearer token-says-hello');
        });

        it('overrides authorization when presents in options.headers', async () => {
            const headers = { authorization: 'Bearer new-token-that-overrides' };
            await request.get('/hello', { headers });
            const { fetchOptions } = mock.spy.params[0];
            assert.equal(fetchOptions?.headers?.authorization, headers.authorization);
        });

        it('overrides config.headers when presents in options.headers', async () => {
            const headers = { 'custom-header': 'new-header-that-overrides' };
            await request.get('/hello', { headers });
            assert(mock.spy.params[0]);

            const { fetchOptions } = mock.spy.params[0]
            assert.equal(fetchOptions?.headers?.['custom-header'], headers['custom-header']);
        });
    });

});
