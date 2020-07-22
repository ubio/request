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
        });

        context('accessToken not present, refreshToken present', () => {
            let oauth2: OAuth2;

            beforeEach(async () => {
                oauth2 = new OAuth2({
                    ...baseParams,
                    refreshToken: 'i-am-refresh-token'
                });

                oauth2.requestToken = mockToken;
            });

            it('refreshes new tokens with refreshToken', async () => {
                const authorization = await oauth2.getHeader();
                assert(authorization);

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

                oauth2.requestToken = mockToken;
            });

            it('requests new tokens with grant_type client_credentials', async () => {
                const authorization = await oauth2.getHeader();
                assert(authorization);

                assert(oauth2.accessToken);
                assert(oauth2.expiresAt);
                assert(oauth2.refreshToken);
            });
        });
    });
});
