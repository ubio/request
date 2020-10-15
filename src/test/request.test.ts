// Copyright 2020 UBIO Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import assert from 'assert';
import {
    Request,
    BearerAuthAgent,
    fetchMock,
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
                retryStatusCodes: [504],
            });

            try {
                await request.send('get', '/');
                throw new Error('UnexpectedSuccess');
            } catch (error) {
                assert.strictEqual(error.details.status, 504);
                assert.strictEqual(fetch.spy.called, true);
                assert.strictEqual(fetch.spy.calledCount, retryAttempts + 1);
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
            } catch (error) {
                assert.strictEqual(error.details.status, 400);
                assert.strictEqual(fetch.spy.called, true);
                assert.strictEqual(fetch.spy.calledCount, 1);

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
            request.onRetry = err => { thrownError = err };
            await request.send('get', 'http://example.com').catch(() => {});
            assert.ok(thrownError);
            assert.strictEqual(thrownError.details.status, 504);
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

            const { fetchOptions } = fetch.spy.params[0]
            assert.strictEqual(fetchOptions?.headers?.['custom-header'], headers['custom-header']);
        });
    });

    describe('invalidate auth', () => {

        it('invalidates auth once', async () => {
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
            } catch (error) {
                assert.strictEqual(invalidated, true);
                assert.strictEqual(error.details.status, 401);
                assert.strictEqual(fetch.spy.called, true);
                assert.strictEqual(fetch.spy.calledCount, 2);
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
