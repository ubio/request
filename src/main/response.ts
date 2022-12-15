// eslint-disable-next-line import/no-default-export
export default (() => {
    return typeof Response === 'undefined' ? require('node-fetch').Response : Response;
})() as UnifiedResponse;

export type UnifiedResponse = {
    new(body?: BodyInit | null, init?: ResponseInit): Response;
    error(): Response;
    redirect(url: string, status?: number): Response;
    readonly headers: Headers;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly trailer: Promise<Headers>;
    readonly type: ResponseType;
    readonly url: string;
    clone(): Response;
};
