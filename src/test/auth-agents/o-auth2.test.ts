import assert from 'assert';
import { OAuth2Agent } from '../../main/auth-agents';

describe('AuthAgent.OAuth2', () => {
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
            const oauth2 = new OAuth2Agent({
                ...baseParams,
                accessToken: 'hello-token',
                expiresAt: Date.now() + 10000,
                minValiditySeconds: 0,
            });

            const authorization = await oauth2.getHeader();
            assert.equal(authorization, 'Bearer hello-token');
        });

        it('does not return saved accessToken when expired', async () => {
            const oauth2 = new OAuth2Agent({
                ...baseParams,
                accessToken: 'hello-token',
                expiresAt: Date.now() - 10000,
                minValiditySeconds: 0,
            });

            const authorization = await oauth2.getHeader();
            assert.notEqual(authorization, 'Bearer hello-token');
        });

        context('token expires in 10 seconds', () => {
            it('returns given token when minValiditySeconds = 5', async () => {
                const oauth2 = new OAuth2Agent({
                    ...baseParams,
                    accessToken: 'hello-token',
                    expiresAt: Date.now() + 10 * 1000,
                    minValiditySeconds: 5,
                });

                const authorization = await oauth2.getHeader();
                assert.equal(authorization, 'Bearer hello-token');
            });

            it('does not return give token when minValiditySeconds = 15', async () => {
                const oauth2 = new OAuth2Agent({
                    ...baseParams,
                    accessToken: 'hello-token',
                    expiresAt: Date.now() + 10 * 1000,
                    minValiditySeconds: 15,
                });

                const authorization = await oauth2.getHeader();
                assert.notEqual(authorization, 'Bearer hello-token');
            });
        });
    });

    context('accessToken not present, refreshToken present', () => {
        let oauth2: OAuth2Agent;

        beforeEach(async () => {
            oauth2 = new OAuth2Agent({
                ...baseParams,
                refreshToken: 'i-am-refresh-token'
            });

            oauth2.createToken = mockToken;
        });

        it('refreshes new tokens with refreshToken', async () => {
            const authorization = await oauth2.getHeader();
            assert(authorization);

            assert(oauth2.params.accessToken);
            assert(oauth2.params.expiresAt);
            assert(oauth2.params.refreshToken);
        });
    });

    context('accessToken not present, refreshToken not present', () => {
        let oauth2: OAuth2Agent;

        beforeEach(async () => {
            oauth2 = new OAuth2Agent({
                ...baseParams,
                clientSecret: 'i-am-secret'
            });

            oauth2.createToken = mockToken;
        });

        it('requests new tokens with grant_type client_credentials', async () => {
            const authorization = await oauth2.getHeader();
            assert(authorization);

            assert(oauth2.params.accessToken);
            assert(oauth2.params.expiresAt);
            assert(oauth2.params.refreshToken);
        });
    });
});
