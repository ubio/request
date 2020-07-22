import assert from 'assert';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { Exception } from '../exception';
import { RequestAuthorization } from '../definitions';

type GrantType = 'client_credentials' | 'refresh_token'; // 'authorization_code'
export interface OAuth2Params {
    // required
    clientId: string;
    tokenUrl: string;
    grantType?: GrantType;

    // optional
    clientSecret?: string;
    refreshToken?: string;
    // not manually set preferably
    accessToken?: string;
    expiresAt?: number;
    // frontend only
    // authUrl?: string;
    // redirectUrl?: string;
    // code?: string;
}

export class OAuth2 implements RequestAuthorization {
    // not manually set preferably
    grantType: GrantType;
    clientId: string;
    tokenUrl: string;

    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string;
    expiresAt?: number;

    constructor(params: OAuth2Params) {
        this.grantType = params.grantType || 'client_credentials';
        this.tokenUrl = params.tokenUrl;
        this.clientId = params.clientId;
        this.refreshToken = params.refreshToken;
        this.accessToken = params.accessToken;
        this.expiresAt = params.expiresAt;
        this.clientSecret = params.clientSecret;
    }

    async getHeader(): Promise<string> {
        /** if access token available,
         *  -> check expiresAt, if not expired -> return it
         *
         * if refreshToken available
         *  -> try refreshing, if succeed, update accessToken, refreshToken and expiresAt
         *
         * if above fails or refreshToken is not available,
         *  -> check grant_type is client_credentials if it is, get the tokens
         *
         * (optional) if the machine allows authorization_code grant type, open it, and do the stuff.
         */

        if (this.accessToken && this.expiresAt && Date.now() < this.expiresAt) {
            return `Bearer ${this.accessToken}`;
        }

        let tokens = null;
        if (this.refreshToken) {
            try {
                //
                tokens = await this.token({ refresh: true });
            } catch (error) {
                // log the failed attempts?
            }
        }

        if (tokens == null) {
            tokens = await this.token();
        }

        this.setTokens(tokens);

        return `Bearer ${tokens.accessToken}`;

        // not handling frontend-app yet.
    }

    /* frontend app

    async createTokenByCode(code: string, redirectUri: string) {
        const params = {
            'grant_type': 'authorization_code',
            'client_id': this.clientId,
            'redirect_uri': redirectUri,
            code,
        };
        return await this.token();
    }
    */

    async token(options: { refresh?: boolean; params?: any } = {}) {
        const params = {
            'grant_type': this.grantType,
            'client_id': this.clientId,
            'client_secret': this.clientSecret || '',
            ...options.params || {}
        } as any;

        if (options.refresh) {
            assertIsDefined(this.refreshToken);
            params['grant_type'] = 'refresh_token';
            params['refresh_token'] = this.refreshToken;
        }

        const res = await fetch(this.tokenUrl, {
            method: 'POST',
            body: new URLSearchParams(params),
        });

        const resBody = await res.json();

        // revisit the error code
        if (!res.ok) {
            throw new Exception({
                name: 'UnexpectedStatusError',
                message: 'unexpected status code',
                details: {
                    status: res.status,
                    ...resBody
                },
            });
        }
        return decodeTokenResponse(resBody);
    }

    setTokens(tokens: Tokens) {
        this.accessToken = tokens.accessToken;
        this.expiresAt = Date.now() + (tokens.accessExpiresIn * 1000);
        this.refreshToken = tokens.refreshToken;
    }
}

export interface Tokens {
    accessToken: string;
    accessExpiresIn: number;
    refreshToken: string;
}

function assertIsDefined<T>(val: T): asserts val is NonNullable<T>  {
    assert(val != null, `Expected 'val' to be defined, but received ${val}`);
}

function decodeTokenResponse(res: { [key: string]: any }): Tokens {
    assertPropertyType(res, 'access_token', 'string');
    assertPropertyType(res, 'refresh_token', 'string');
    assertPropertyType(res, 'expires_in', 'number');
    return {
        accessToken: res['access_token'],
        accessExpiresIn: res['expires_in'],
        refreshToken: res['refresh_token'],
    };
}

function assertPropertyType(obj: { [key: string]: any }, propertyName: string, type: string, optional: boolean = false) {
    const val = obj[propertyName];
    if (val == null && optional) {
        return;
    }

    const actualType = typeof val;
    assert(actualType === type, `expected ${propertyName} to be ${type}, but got ${actualType}`);
}
