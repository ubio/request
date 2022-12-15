export abstract class AuthAgent {
    abstract getHeader(requestOptions?: any): Promise<string | null>;
    abstract invalidate(): void;
}
