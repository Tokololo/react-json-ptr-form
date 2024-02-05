import { useMemo } from "react";
import { IJsonPrtFormValidator, ISchema, IPrtFormError } from "./validator";
import Ajv, { AnySchema, ErrorObject } from 'ajv';
import addFormats from "ajv-formats";

let AJV: Ajv | undefined;

const joinPtrs = (...ptrs: string[]): string => {

    let joined = ptrs.join('/').replaceAll("//", "/");
    joined = joined.length > 1 && joined.endsWith('/') ? joined.slice(0, -1) : joined;
    return joined.indexOf('/', 0) === 0 ? joined : '/' + joined;

}

const newAjv = () => {

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    return ajv;

}

export interface IAjvSchema extends ISchema {
    schema: AnySchema
}

export interface IAjvError extends IPrtFormError, ErrorObject { };

export const createAjv = (schemas?: IAjvSchema[]) => {

    AJV = newAjv();
    schemas?.forEach(schema => AJV!.addSchema(schema.schema, schema.tag));

}

export const ajvErrorsToPtrErrors = (errors: IAjvError[]) => {

    const res: { [ptr: string]: IAjvError } = {};

    for (let i = 0; i < errors.length; ++i) {
        const ptr = joinPtrs(...[errors[i].instancePath, errors[i].params?.missingProperty ? errors[i].params?.missingProperty : undefined].filter(a => !!a));
        res[ptr] = errors[i];
    }

    return res;

}

export const useAjvValidator = () =>

    useMemo<IJsonPrtFormValidator<IAjvSchema, IAjvError>>(() => {

        const ajv = AJV || newAjv();

        return {
            addSchema: async schema => {
                if (!ajv.getSchema(schema.tag))
                    ajv.addSchema(schema.schema, schema.tag);
            },
            removeSchema: async tag => {
                if (!!ajv.getSchema(tag)) {
                    ajv.removeSchema(ajv.getSchema(tag)?.schema);
                    ajv.removeSchema(tag);
                }
            },
            validateSchema: async (tag, value) => {

                const schema = ajv.getSchema(tag)?.schema;

                if (!schema) {
                    console.log(new Error(`Schema not found: ${tag}`));
                    return {};
                }

                const valid = ajv.validate(schema, value);

                if (!valid)
                    return ajvErrorsToPtrErrors(ajv.errors!);

                return {};

            }
        }

    }, []);