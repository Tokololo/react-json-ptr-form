import { useMemo } from "react";
import { IJsonPrtFormValidator, ISchema, IPrtFormError } from "./validator";
import Ajv, { AnySchema, ErrorObject, Options } from 'ajv';
import addFormats from "ajv-formats";
import ajvErrors from "ajv-errors";

let AJV: Ajv | undefined;

const joinPtrs = (...ptrs: string[]): string => {

    let joined = ptrs.join('/').replaceAll("//", "/");
    joined = joined.length > 1 && joined.endsWith('/') ? joined.slice(0, -1) : joined;
    return joined.indexOf('/', 0) === 0 ? joined : '/' + joined;

}

const newAjv = (
    opts?: Options,
    plugins?: {
        ajvFormats?: boolean,
        ajvErrors?: boolean
    }) => {

    const ajv = new Ajv(opts || { allErrors: true });
    if (plugins?.ajvFormats)
        addFormats(ajv);
    if (plugins?.ajvErrors)
        ajvErrors(ajv);
    return ajv;

}

export interface IAjvSchema extends ISchema {
    schema: AnySchema
}

export interface IAjvError extends IPrtFormError, ErrorObject { };

export const createAjv = (
    schemas?: IAjvSchema[],
    opts?: Options,
    plugins?: {
        ajvFormats?: boolean,
        ajvErrors?: boolean
    },
    ajv?: Ajv) => {

    AJV = ajv || newAjv(opts, plugins);
    schemas?.forEach(schema => AJV!.addSchema(schema.schema, schema.tag));

}

export const ajvErrorsToPtrErrors = (errors: IAjvError[]) => {

    const res: { [ptr: string]: IAjvError[] } = {};

    for (let i = 0; i < errors.length; ++i) {
        const ptr = joinPtrs(...[errors[i].instancePath, errors[i].params?.missingProperty ? errors[i].params?.missingProperty : undefined].filter(a => !!a));
        res[ptr] = res[ptr] || [];
        res[ptr].push(errors[i]);
    }

    return res;

}

export const useAjvValidator = <T extends { [prop: string]: any } = {}>(
    opts?: Options,
    plugins?: {
        ajvFormats?: boolean,
        ajvErrors?: boolean
    }
) =>

    useMemo<IJsonPrtFormValidator<T, IAjvSchema, IAjvError>>(() => {

        const ajv = AJV || newAjv(opts, plugins);

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
                    console.log(new Error(`Ajv Schema not found: ${tag}`));
                    return {};
                }

                const valid = ajv.validate(schema, value);

                if (!valid)
                    return ajvErrorsToPtrErrors(ajv.errors!);

                return {};

            }
        }

    }, []);