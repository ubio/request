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

## Request Options

all options are optional, values used below example are default values.

```ts
const request = new Request({
    // The base url
    baseUrl: 'https://example.com',

    // auth agent. when you want it to manage the auth stuff.
    // e.g. BasicAuthAgent will set headers.authorization = `Basic ...` automatically when sending a request
    auth: new NoneAuthAgent();

    // default to 10.
    retryAttempts: 10;

    // interval between retries
    retryDelay: 500,

    // The HTTP response status codes that will automatically be retried.
    // Along with status codes, requests will be retried when it fails with predefined network error codes
    // see NETWORK_ERRORS in  src/main/request.ts
    statusCodesToRetry: [401, 429, [502, 504]],

    // The HTTP response status codes that will invalidate the auth.
    // It's going to be used by AuthAgent that implements invalidate method, such as OAuth2Agent
    statusCodeToInvalidateAuth: [401, 403],

    // some default headers to add to requests
    headers: {},

    // fetch module - default to node-fetch
    fetch: nodeFetch,

    // callback function which will be called on retry
    onRetry: () => {},

    // callback function which will be called on error
    onError: () => {},

    // handler on error to evaluate whether it should retry
    handleShouldRetry: () => false
});

```
