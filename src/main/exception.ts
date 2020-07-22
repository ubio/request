export interface ExceptionSpec {
    name: string;
    code?: string;
    message?: string;
    status?: number;
    details?: object;
}

export class Exception extends Error {
    code: string;
    status?: number;
    details?: any;

    constructor(spec: ExceptionSpec) {
        super(spec.message);
        this.name = spec.name;
        this.code = spec.code || spec.name;
        this.message = spec.message || spec.name;
        if (spec.status != null) {
            this.status = spec.status;
        }
        this.details = spec.details;
    }

}
