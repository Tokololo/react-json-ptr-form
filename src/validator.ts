export interface ISchema {
    tag: string
}

export interface IPrtFormError {
    message?: string
}

export interface IJsonPrtFormValidator<
    T,
    U extends ISchema = ISchema,
    V extends IPrtFormError = IPrtFormError> {

    addSchema(schema: U): Promise<void>;
    validateSchema(tag: string, value: T): Promise<{ [ptr: string]: V[] }>;
    removeSchema(tag: string): Promise<void>;

}