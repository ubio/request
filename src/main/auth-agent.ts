import EventEmitter from 'eventemitter3';

export abstract class AuthAgent extends EventEmitter {
    abstract getHeader(requestOptions?: any): Promise<string | null>;
    abstract invalidate(): void;
}
