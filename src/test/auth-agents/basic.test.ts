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
    });
});
