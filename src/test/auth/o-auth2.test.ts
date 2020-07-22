import assert from 'assert';
import { OAuth2 } from '../../main/auth';

describe('request', () => {
    describe('o-auth2', () => {
        const baseParams = {
            clientId: 'i-am-client',
            tokenUrl: 'http://example.com',
        };

        const mockToken = async (options = {}) => {
            return {
                accessToken: 'new-access-token-' + JSON.stringify(options),
                accessExpiresIn: Date.now() + 60000,
                refreshToken: 'new-refresh-token',
            };
        };

        context('access token present', () => {
            it('returns given access token', async () => {
                const oauth2 = new OAuth2({
                    ...baseParams,
                    accessToken: 'return-me-back',
                    expiresAt: Date.now() + 10000,
                });

                const authorization = await oauth2.getHeader();
                assert.equal(authorization, 'Bearer return-me-back');
            });

            it('refreshes token when expiresAt is in the past', async () => {
                const oauth2 = new OAuth2({
                    ...baseParams,
                    accessToken: 'stale-access-token',
                    expiresAt: Date.now() - 10000,
                    refreshToken: 'stale-refresh-token'
                });

                oauth2.token = mockToken;

                const authorization = await oauth2.getHeader();
                assert(authorization);
                assert(authorization.includes('"refresh":true'));
                assert.equal(oauth2.accessToken?.includes('new-access-token'), true);
                assert.equal(oauth2.refreshToken, 'new-refresh-token');
            });
        });

        context('accessToken not present, refreshToken present', () => {
            let oauth2: OAuth2;

            beforeEach(async () => {
                oauth2 = new OAuth2({
                    ...baseParams,
                    refreshToken: 'i-am-refresh-token'
                });

                oauth2.token = mockToken;
            });

            it('calls token endpoint with refresh option', async () => {
                const authorization = await oauth2.getHeader();
                assert(authorization);
                assert.equal(authorization.includes('refresh'), true);
            });

            it('sets returned tokens', async () => {
                await oauth2.getHeader();
                assert(oauth2.accessToken);
                assert(oauth2.expiresAt);
                assert(oauth2.refreshToken);
            });
        });

        context('accessToken not present, refreshToken not present', () => {
            let oauth2: OAuth2;

            beforeEach(async () => {
                oauth2 = new OAuth2({
                    ...baseParams,
                    clientSecret: 'i-am-secret'
                });

                oauth2.token = mockToken;
            });

            it('calls token endpoint without refresh option', async () => {
                const authorization = await oauth2.getHeader();

                assert(authorization);
                assert.equal(authorization.includes('refresh'), false);
            });

            it('sets returned tokens', async () => {
                await oauth2.getHeader();
                assert(oauth2.accessToken);
                assert(oauth2.expiresAt);
                assert(oauth2.refreshToken);
            });
        });
    });
});
