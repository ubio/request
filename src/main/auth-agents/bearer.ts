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

import { AuthAgent } from '../auth-agent';

export class BearerAuthAgent extends AuthAgent {
    params: BearerAuthParams;

    constructor(params: BearerAuthParams) {
        super();
        this.params = params;
    }

    async getHeader() {
        const { prefix = 'Bearer', token } = this.params;
        return token ? `${prefix} ${token}`: null;
    }

    invalidate() {
    }
}

export interface BearerAuthParams {
    prefix?: string;
    token?: string;
}
