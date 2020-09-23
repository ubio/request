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

import assert from 'assert';
import { BasicAuthAgent } from '../../main/auth-agents';

describe('AuthAgent.Basic', () => {
    it('returns basic header', async () => {
        const auth = new BasicAuthAgent({
            username: 'hello',
            password: 'world'
        });

        const header = await auth.getHeader();
        assert(header);
        const [name, value] = header.split(' ');
        assert.equal(name, 'Basic');
        const decode = Buffer.from(value, 'base64').toString('utf8');
        assert.equal(decode, 'hello:world');
    })
});
