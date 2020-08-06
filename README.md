# @automationcloud/request

```ts
import { Request } from '@automationcloud/request';

const request = new Request({
  baseUrl: 'https://example.com',
  headers: {
    'common-headers': 'foo'
  },
  
});

// JSON request shortcuts
const json = await request.post('/foo', {
  query,
  headers,
  body,
});

// Generic
const response = await request.post({
  method: 'POST',
  url: '/bar',
  headers: { ... },
  body: string | Buffer | URLSearchParams,
});
```
