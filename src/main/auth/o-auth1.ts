import crypto from 'crypto';
import OAuth1Helper from 'oauth-1.0a';
import {
    RequestAuthorization,
 } from '../definitions';

export enum OAuth1SignatureMethod {
    HMAC_SHA1 = 'HMAC-SHA1',
    HMAC_SHA256 = 'HMAC-SHA256',
    RSA_SHA1 = 'RSA-SHA1',
    PLAINTEXT = 'PLAINTEXT',
}

export class OAuth1 implements RequestAuthorization {
    // required
    consumerKey: string;
    consumerSecret: string;
    signatureMethod: OAuth1SignatureMethod;

    // optional
    tokenKey: string;
    tokenSecret: string;
    privateKey: string; // when signatureMethod is RSA_SHA1
    version?: string;
    realm?: string;
    callback?: string;
    verifier?: string;
    timestamp?: string;
    nonce?: string;
    includeBodyHash?: boolean;

    constructor(params: OAuth1Params) {
        this.consumerKey = params.consumerKey;
        this.consumerSecret = params.consumerSecret;
        this.signatureMethod = params.signatureMethod;

        this.tokenKey = params.tokenKey = '';
        this.tokenSecret = params.tokenSecret ='';
        this.privateKey = params.privateKey ='';
        this.version = params.version || '1.0';
        this.realm = params.realm;
        this.callback = params.callback;
        this.verifier = params.verifier;
        this.timestamp = params.timestamp;
        this.nonce = params.nonce;
        this.includeBodyHash = params.includeBodyHash;
    }

    async getHeader(options: any): Promise<string> {
        const { url, method, body = null } = options;
        const oauth = new OAuth1Helper({
            consumer: {
                key: this.consumerKey,
                secret: this.consumerSecret
            },
            signature_method: this.signatureMethod,
            version: this.version,
            hash_function: hashFunction(this.signatureMethod),
            realm: this.realm
        });

        const requestData = {
            url,
            method,
            includeBodyHash: false,
            data: {
                // These are conditionally filled in below
                oauth_callback: this.callback,
                oauth_nonce: this.nonce,
                oauth_timestamp: this.timestamp,
                oauth_verifier: this.verifier
            } as any
        };

        if (
            this.includeBodyHash &&
            body &&
            Array.isArray(body)
        ) {
            requestData.includeBodyHash = true;
            for (const [key, value] of body) {
                requestData.data[key] = value;
            }
        }

        let token;
        if (this.tokenKey) {
            token = {
                key: this.tokenKey,
                secret: this.tokenSecret
            };

        } else if (this.signatureMethod === OAuth1SignatureMethod.RSA_SHA1) {
            token = {
                key: this.tokenKey,
                secret: this.privateKey
            };
            // We override getSigningKey for RSA-SHA1 because we don't want ddo/oauth-1.0a to percentEncode the token
            oauth.getSigningKey = function(tokenSecret: string) {
                return tokenSecret || '';
            };
        }

        const data = oauth.authorize(requestData, token);
        const header = oauth.toHeader(data);

        return 'Authorization ' + header.Authorization;
    }
}

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

    throw new Error(`Invalid signature method ${signatureMethod}`);
}
