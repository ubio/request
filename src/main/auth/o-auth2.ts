import assert from 'assert';
import { URLSearchParams } from 'url';
import { Request } from '../request';
import { RequestAuthorization, AuthRetryConfig } from '../definitions';

export enum OAuth2GrantType {
    CLIENT_CREDENTIALS = 'client_credentials',
    REFRESH_TOKEN = 'refresh_token',
}

export interface OAuth2Params {
    // required if we want to enforce refreshing..
    clientId: string;
    tokenUrl: string;

    // optional
    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string;
    expiresAt?: number;
}

export class OAuth2 implements RequestAuthorization, OAuth2Params {
    retryConfig: AuthRetryConfig;

    clientId: string;
    tokenUrl: string;
    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string;
    expiresAt?: number;

    constructor(params: OAuth2Params, retryConfig?: AuthRetryConfig) {
        this.tokenUrl = params.tokenUrl;
        this.clientId = params.clientId;
        this.refreshToken = params.refreshToken;
        this.accessToken = params.accessToken;
        this.expiresAt = params.expiresAt;
        this.clientSecret = params.clientSecret;

        const defaultRetryConfig = {
            delay: 1000,
            attempts: 5,
            statusCodesToRetry: [[401, 401]]
        };

        this.retryConfig = retryConfig || defaultRetryConfig;
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
         * note: do not handle authorization_code grant type
         */

        if (this.accessToken/*  && this.expiresAt && Date.now() < this.expiresAt */) {
            return `Bearer ${this.accessToken}`;
        }


        let tokens = null;
        if (this.refreshToken) {
            try {
                tokens = await this.requestToken(this.refreshToken);
            } catch (error) {
                //todo: log the failed attempts
            }
        }

        if (tokens == null) {
            tokens = await this.requestToken();
        }

        //save tokens in case we want to reuse it
        this.setToken(tokens);

        return `Bearer ${tokens.accessToken}`;
    }

    async requestToken(refreshToken?: string) {
        const params: { [k: string]: string } = {
            'grant_type': OAuth2GrantType.CLIENT_CREDENTIALS,
            'client_id': this.clientId,
            'client_secret': this.clientSecret || '',
        };

        if (refreshToken) {
            params['grant_type'] = OAuth2GrantType.REFRESH_TOKEN;
            params['refresh_token'] = refreshToken;
        }

        const request = new Request({
            baseUrl: this.tokenUrl,
            jsonResponse: true,
        });

        const response = await request.post('/', {
            body: new URLSearchParams(params),
        });

        return decodeTokenResponse(response);
    }

    setToken(tokens: OAuth2Tokens) {
        this.accessToken = tokens.accessToken;
        this.expiresAt = Date.now() + (tokens.accessExpiresIn * 1000);
        this.refreshToken = tokens.refreshToken;
    }
}

export interface OAuth2Tokens {
    accessToken: string;
    accessExpiresIn: number;
    refreshToken: string;
}

export interface OAuth2TokenOptions {
    OAuth2grantType: OAuth2GrantType;
    refreshToken?: string;
}


function decodeTokenResponse(res: { [key: string]: any }): OAuth2Tokens {
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
