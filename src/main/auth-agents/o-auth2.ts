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

import { Request } from '../request';
import { Fetch } from '../types';
import fetch from '../fetch';
import { AuthAgent } from '../auth-agent';

export enum OAuth2GrantType {
    CLIENT_CREDENTIALS = 'client_credentials',
    REFRESH_TOKEN = 'refresh_token',
    AUTHORIZATION_CODE = 'authorization_code',
    PASSWORD = 'password',
}

export interface OAuth2Params {
    clientId: string;
    tokenUrl: string;
    clientSecret?: string;
    refreshToken?: string | null;
    accessToken?: string | null;
    expiresAt?: number | null;
    minValiditySeconds?: number; // default: 5 * 60, margin for accessToken's expiresAt
    fetch?: Fetch;
}

export class OAuth2Agent extends AuthAgent {
    params: OAuth2Params;

    constructor(params: OAuth2Params) {
        super();
        this.params = {
            fetch,
            ...params,
        };
    }

    async getHeader(): Promise<string | null> {
        const accessToken = await this.getAccessToken();
        return accessToken ? `Bearer ${accessToken}` : null;
    }

    async createToken(params: OAuth2TokenParams) {
        const { tokenUrl, fetch } = this.params;
        const request = new Request({ fetch });
        const p = Object.entries(params).filter(([_k, v]) => v != null);
        const response = await request.send('post', tokenUrl, {
            body: new URLSearchParams(p),
        });
        const json = await response.json();
        const tokens = {
            accessToken: json['access_token'],
            accessExpiresIn: json['expires_in'],
            refreshToken: json['refresh_token'],
        };
        return tokens;
    }

    setTokens(tokens: Partial<OAuth2Tokens>) {
        const {
            accessToken,
            accessExpiresIn,
            refreshToken
        } = tokens;
        const expiresAt = accessExpiresIn ?
            Date.now() + (accessExpiresIn * 1000) :
            null;
        this.params.accessToken = accessToken;
        this.params.expiresAt = expiresAt;
        if (refreshToken) {
            this.params.refreshToken = refreshToken;
        }
    }

    invalidate() {
        this.params.accessToken = null;
        this.params.expiresAt = null;
    }

    async getAccessToken(): Promise<string | null> {
        const fallbacks = [
            this.tryCachedAccessToken,
            this.tryRefreshToken,
            this.tryClientSecret,
        ];
        for (const fn of fallbacks) {
            try {
                const accessToken = await fn.call(this);
                if (accessToken) {
                    return accessToken;
                }
            } catch (error) {
                this.invalidate();
            }
        }
        return null;
    }

    protected async tryCachedAccessToken() {
        const { accessToken, expiresAt, minValiditySeconds = 5 * 60 } = this.params;
        const accessTokenValid = expiresAt != null &&
            expiresAt - minValiditySeconds * 1000 > Date.now();
        if (accessToken && accessTokenValid) {
            return accessToken;
        }
        return null;
    }

    protected async tryRefreshToken() {
        const { refreshToken, clientId, clientSecret } = this.params;
        if (!refreshToken) {
            return null;
        }
        try {
            const tokens = await this.createToken({
                'grant_type': OAuth2GrantType.REFRESH_TOKEN,
                'client_id': clientId,
                'client_secret': clientSecret,
                'refresh_token': refreshToken,
            });
            this.setTokens(tokens);
            return tokens.accessToken;
        } catch (error) {
            // Refresh token no longer valid
            this.params.refreshToken = null;
            throw error;
        }
    }

    protected async tryClientSecret() {
        const { clientId, clientSecret } = this.params;
        if (!clientSecret) {
            return null;
        }
        const tokens = await this.createToken({
            'grant_type': OAuth2GrantType.CLIENT_CREDENTIALS,
            'client_id': clientId,
            'client_secret': clientSecret,
        });
        this.setTokens(tokens);
        return tokens.accessToken;
    }
}

export interface OAuth2Tokens {
    accessToken: string;
    accessExpiresIn: number;
    refreshToken?: string;
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
