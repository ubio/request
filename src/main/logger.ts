/* eslint-disable no-console */
/**
 * Standard logging interface, compatible with `console`.
 *
 * Use this interface to provide your own logging system to Automation Cloud Client
 * (either directly or via an adapter).
 */
export interface Logger {
    info(message: string, object?: any): void;
    warn(message: string, object?: any): void;
    error(message: string, object?: any): void;
    debug(message: string, object?: any): void;
}
