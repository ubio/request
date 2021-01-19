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

import crypto from 'crypto';
import OAuth1Helper from 'oauth-1.0a';
import { AuthAgent } from '../auth-agent';
import { Exception } from '../exception';

export interface OAuth1Params {
    // required
    consumerKey: string;
    consumerSecret: string;
    signatureMethod: OAuth1SignatureMethod;
    // optional
    tokenKey?: string;
    tokenSecret?: string;
    privateKey?: string; // when signatureMethod is RSA_SHA1
    version?: string;
    realm?: string;
    callback?: string;
    verifier?: string;
    timestamp?: string;
    nonce?: string;
    includeBodyHash?: boolean;
}

export enum OAuth1SignatureMethod {
    HMAC_SHA1 = 'HMAC-SHA1',
    HMAC_SHA256 = 'HMAC-SHA256',
    RSA_SHA1 = 'RSA-SHA1',
    PLAINTEXT = 'PLAINTEXT',
}

export class OAuth1Agent extends AuthAgent {

    constructor(protected params: OAuth1Params) {
        super();
        this.params = {
            ...params,
        };
    }

    async getHeader(options: any): Promise<string> {
        const { url, method, body = null } = options;
        const oauth = new OAuth1Helper({
            consumer: {
                key: this.params.consumerKey,
                secret: this.params.consumerSecret
            },
            signature_method: this.params.signatureMethod,
            version: this.params.version,
            hash_function: hashFunction(this.params.signatureMethod),
            realm: this.params.realm
        });

        const allData = {
            oauth_callback: this.params.callback,
            oauth_nonce: this.params.nonce,
            oauth_timestamp: this.params.timestamp,
            oauth_verifier: this.params.verifier
        };

        const data = {} as any;
        for (const [k, v] of Object.entries(allData)) {
            if (v != null) {
                data[k] = v;
            }
        }

        const requestData = {
            url,
            method,
            includeBodyHash: false,
            data,
        };

        if (this.params.includeBodyHash &&
            body &&
            Array.isArray(body)) {
            requestData.includeBodyHash = true;
            for (const [key, value] of body) {
                requestData.data[key] = value;
            }
        }

        const { tokenKey, tokenSecret = '', privateKey = '', signatureMethod } = this.params;
        let token;
        if (tokenKey) {
            token = {
                key: tokenKey,
                secret: tokenSecret
            };

            if (signatureMethod === OAuth1SignatureMethod.RSA_SHA1) {
                token.secret = privateKey;
                // We override getSigningKey for RSA-SHA1 because we don't want ddo/oauth-1.0a to percentEncode the token
                oauth.getSigningKey = function(tokenSecret: string) {
                    return tokenSecret || '';
                };
            }
        }

        const authData = oauth.authorize(requestData, token);
        const header = oauth.toHeader(authData);

        return header.Authorization;
    }

    invalidate() {}
}

// helpers
function hashFunction(signatureMethod: OAuth1SignatureMethod) {
    if (signatureMethod === OAuth1SignatureMethod.HMAC_SHA1) {
        return function(baseString: string, key: string): string {
            return crypto
                .createHmac('sha1', key)
                .update(baseString)
                .digest('base64');
        };
    }

    if (signatureMethod === OAuth1SignatureMethod.HMAC_SHA256) {
        return function(baseString: string, key: string): string {
            return crypto
                .createHmac('sha256', key)
                .update(baseString)
                .digest('base64');
        };
    }

    if (signatureMethod === OAuth1SignatureMethod.RSA_SHA1) {
        return function(baseString: string, privatekey: string): string {
            return crypto
                .createSign('RSA-SHA1')
                .update(baseString)
                .sign(privatekey, 'base64');
        };
    }

    if (signatureMethod === OAuth1SignatureMethod.PLAINTEXT) {
        return function(baseString: string): string {
            return baseString;
        };
    }

    throw new OAuth1Error(`Invalid signature method ${signatureMethod}`);
}

export class OAuth1Error extends Exception {}
