import assert from 'assert';
import { URLSearchParams } from 'url';
import { Request } from '../request';
import {
    AuthAgent,
} from '../types';

export enum OAuth2GrantType {
    CLIENT_CREDENTIALS = 'client_credentials',
    REFRESH_TOKEN = 'refresh_token',
    AUTHORIZATION_CODE = 'authorization_code',
    PASSWORD = 'password',
}

export interface OAuth2Params {
    // required if we want to enforce refreshing..
    clientId: string;
    tokenUrl: string;

    // optional
    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string | null;
    expiresAt?: number | null;
}

export class OAuth2Agent implements AuthAgent {
    params: OAuth2Params;

    constructor(params: OAuth2Params) {
        this.params = { ...params };
    }

    async getHeader(): Promise<string> {
        const accessToken = await this.getAccessToken();
        return `Bearer ${accessToken}`;
    }

    async getAccessToken() {
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
        const { accessToken, expiresAt, refreshToken } = this.params;
        if (accessToken && expiresAt && Date.now() < expiresAt) {
            return accessToken;
        }

        let tokens = null;
        if (refreshToken) {
            try {
                tokens = await this.requestToken(refreshToken);
            } catch (error) {
                //todo: log the failed attempts
            }
        }

        if (tokens == null) {
            tokens = await this.requestToken();
        }

        //save tokens in case we want to reuse it
        this.setToken(tokens);

        return tokens.accessToken;
    }

    async requestToken(refreshToken?: string) {
        const { clientId, clientSecret } = this.params;
        const params: OAuth2TokenParams = {
            'grant_type': OAuth2GrantType.CLIENT_CREDENTIALS,
            'client_id': clientId,
            'client_secret': clientSecret,
        };

        if (refreshToken) {
            params['grant_type'] = OAuth2GrantType.REFRESH_TOKEN;
            params['refresh_token'] = refreshToken;
        }

        return this.createToken(params);
    }

    async createToken(params: OAuth2TokenParams) {
        const { tokenUrl } = this.params;
        const request = new Request({
            baseUrl: tokenUrl,
        });

        const p = Object.entries(params).filter(([_k, v]) => v != null);
        const response = await request.send('post', '/', {
            body: new URLSearchParams(p),
        });

        return decodeTokenResponse(response);
    }

    setToken(tokens: OAuth2Tokens) {
        this.params.accessToken = tokens.accessToken;
        this.params.expiresAt = Date.now() + (tokens.accessExpiresIn * 1000);
        this.params.refreshToken = tokens.refreshToken;
    }

    invalidate() {
        this.params.accessToken = null;
        this.params.expiresAt = null;
    }
}

export interface OAuth2Tokens {
    accessToken: string;
    accessExpiresIn: number;
    refreshToken: string;
}

export interface OAuth2TokenParams {
    grant_type: OAuth2GrantType;
    refresh_token?: string;
    client_id?: string;
    client_secret?: string;
    redirect_uri?: string;
    code?: string;
    username?: string;
    password?: string;
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
