import { IStoreFlags, Store, strictnessType } from "@tokololo/json-ptr-store";
import { CleanOptions } from "clean-deep";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";
import { combineLatest, from, of, switchMap, tap } from "rxjs";
import { IPrtFormError, IJsonPrtFormValidator, ISchema } from "./validator";
import { cloneJson, deepEqual, objectMap, listPointers, removeDeepUndefined, ptrHas, ptrGet } from "./library";
import { difference, isArray, isPlainObject } from "lodash";

interface IJsonPtrFormControl<T, V extends string | IPrtFormError = string> {
    slot?: string,
    ptr: string,
    form: IJsonPtrFormResult<T, V>,
    render: (args: IJsonPtrFormControlRender<V>) => JSX.Element
}

interface IJsonPtrFormResult<T, V extends string | IPrtFormError = string> {
    valid: (ptr?: string) => boolean;
    values: T;
    value: <W>(ptr: string, clean?: CleanOptions) => W | undefined;
    setValue: (value: any, ptr: string) => void;
    removeValue: (ptr: string) => void;
    resetValue: (value: any, ptr: string) => void;
    rerefValue: (ptr: string) => void;
    errors: { [path: string]: V; };
    error: (ptr: string) => V | undefined;
    touched: (ptr: string) => boolean;
    setTouched: (ptr?: string) => void;
    dirty: (ptr?: string) => boolean;
}

/**
 * Remove a ptr entries' children from an object literal indexed by ptrs.
 * @param obj 
 * @param ptr 
 * @returns 
 */
const removeChildPtrEntries = (
    obj: { [ptr: string]: any },
    ptr: string): { [ptr: string]: any } => {

    const obj1 = { ...obj };
    Object.keys(obj1).forEach(key => {
        if (key.indexOf(ptr) == 0 && key != ptr)
            delete obj1[key];
    });
    return obj1;

}

/**
 * Remove an array ptr entry and its children from an object literal indexed by ptrs.
 * Adjust sibling array indexes to be sequential
 * @param obj 
 * @param ptr_prefix 
 * @param idx 
 */
const removeArrayPtrEntries = (obj: { [ptr: string]: any }, ptr_prefix: string, idx: number): { [ptr: string]: any } => {

    let obj1 = { ...obj };
    let loop = true;

    while (loop) {

        loop = false;
        const next_ptr_prefix = `${ptr_prefix}/${idx + 1}`;
        const cur_ptr_prefix = `${ptr_prefix}/${idx}`;
        Object.entries(obj1).forEach(([key, value]) => {
            if (key.indexOf(next_ptr_prefix) === 0) {
                obj1[key.replace(next_ptr_prefix, cur_ptr_prefix)] = value;
                loop = true;
            }
        });

        if (loop) idx++;

    }

    const last_ptr_prefix = `${ptr_prefix}/${idx}`;
    const obj2 = removeChildPtrEntries(obj1, last_ptr_prefix);
    delete obj2[last_ptr_prefix];
    return obj2;

}

/**
 * Remove a ptr entry from an object literal indexed by ptrs.
 * - if it points to an array item it is removed along with its children and indexes are adjusted to be sequential 
 * - if it points to a non-array item it is removed along with its children
 * @param obj 
 * @param ptr 
 */
const removePtrEntries = (
    obj: { [ptr: string]: any },
    ptr: string) => {

    const parts = ptr.split('/');
    const last_part = parts[parts.length - 1];
    let idx = parseInt(last_part);
    if (!isNaN(idx)) {
        const prefix = parts.slice(0, -1).join('/');
        return removeArrayPtrEntries(obj, prefix, idx);
    }
    else {
        const obj1 = removeChildPtrEntries(obj, ptr);
        delete obj1[ptr];
        return obj1;
    }

}

/**
 * Remove diff child ptr entries between two objects
 * @param ptr 
 * @param prevValue 
 * @param value 
 * @param touched 
 * @returns 
 */
const diffPtrEntries = (
    ptr: string,
    prevValue: any,
    value: any,
    touched: { [ptr: string]: boolean }
) => {

    let _touched = touched;

    if (isArray(prevValue)) {
        if (isArray(value)) {
            if (prevValue.length > value.length) {
                let len = value.length;
                while (len < prevValue.length) {
                    _touched = removeChildPtrEntries(_touched, `${ptr}/${len}`);
                    delete _touched[`${ptr}/${len}`];
                    len++;
                }
            }
        }
        else
            _touched = removeChildPtrEntries(touched, ptr);

    }
    else if (isPlainObject(prevValue)) {
        if (isPlainObject(value)) {
            const diffProps = difference(Object.keys(prevValue), Object.keys(value));
            if (diffProps.length) {
                diffProps.forEach(ptr => {
                    _touched = removeChildPtrEntries(_touched, ptr);
                    delete _touched[ptr];
                });
            }
        }
        else
            _touched = removeChildPtrEntries(touched, ptr);

    }

    return _touched;

}

/**
 * Interface to type JsonPtrFormControl
 */
export interface IJsonPtrFormControlRender<V extends string | IPrtFormError = string> {
    valid: (ptr?: string) => boolean,
    value: <W>(ptr?: string, clean?: CleanOptions) => W | undefined,
    setValue: (val: any, ptr?: string) => void,
    removeValue: (ptr?: string) => void,
    resetValue: (value: any, ptr?: string) => void,
    error: (ptr?: string) => V | undefined,
    rerefValue: (ptr?: string) => void,
    touched: (ptr?: string) => boolean,
    setTouched: (ptr?: string) => void,
    dirty: (ptr?: string) => boolean
}

/**
 * Fields state to manage async validation.
 * Async is needed to keep selected position
 * in text fields when editing.
 * @param ptr 
 * @param initial 
 * @param setValue 
 * @returns 
 */
const useJsonPtrFormFieldState = <T>(
    ptr: string,
    initial: T,
    setValue: (value: T, ptr: string) => void
) => {

    const [field, setField] = useState<T>(initial);

    // NOTE: keep as useMemo instead of useEffect in 
    // case of conditional rendering of the form fields
    // which causes a re-order of hooks which can give 
    // field errors when using useEffect.
    useMemo(() => setField(initial), [initial, ptr]);

    const updateValue = (val: T) => {
        setField(val);
        setValue(val, ptr);
    }

    return {
        value: field,
        updateValue
    };

}

/**
 * JsonPtrForm control for renderering a control.
 * Store must be in default sync mode.
 * @param props 
 * @returns 
 */
export const JsonPtrFormControl = <T, V extends string | IPrtFormError = string>(props: IJsonPtrFormControl<T, V>) => {

    const state = useJsonPtrFormFieldState(
        props.ptr,
        props.form.value<any>(props.ptr),
        props.form.setValue
    );

    return props.render({
        valid: (ptr?: string) => props.form.valid(ptr || props.ptr),
        value: <W = any>(ptr?: string, clean?: CleanOptions) => ptr ? props.form.value<W>(ptr, clean) : removeDeepUndefined(state.value as W, clean),
        setValue: (val: any, ptr?: string) => ptr ? props.form.setValue(val, ptr) : state.updateValue(val),
        removeValue: (ptr?: string) => props.form.removeValue(ptr || props.ptr),
        resetValue: (value: any, ptr?: string) => props.form.resetValue(value, ptr || props.ptr),
        rerefValue: (ptr?: string) => props.form.rerefValue(ptr || props.ptr),
        touched: (ptr?: string) => props.form.touched(ptr || props.ptr),
        setTouched: (ptr?: string) => props.form.setTouched(ptr || props.ptr),
        error: (ptr?: string) => props.form.error(ptr || props.ptr),
        dirty: (ptr?: string) => props.form.dirty(ptr || props.ptr)
    });

}

const useStore = (
    initial?: { [prop: string]: any },
    flags?: IStoreFlags,
    comparer?: <Stricktness extends string = strictnessType>(obj1: any, obj2: any, strictness: Stricktness) => boolean
) => {

    const store = useMemo(() => new Store(initial, flags, comparer), []);

    useEffect(() => {
        return () => store?.destroy();
    }, []);

    return store;

}

/**
 * JsonPtrForm hook
 * @param defaultValue The default value of the store. On change the form resets.
 * @param schemaValidator A schema validator.
 * @param postValidator A post validator to run after the schema validator.
 * @param options - { async?: boolean, validatePreClean?: CleanOptions, fullError?: boolean }
 * @param deps Dependency list. On change the form resets.
 * @returns 
 */
export const useJsonPtrForm = <
    T extends { [prop: string]: any } = {},
    U extends ISchema = ISchema,
    V extends IPrtFormError = IPrtFormError,
    W extends string | IPrtFormError = string
>(
    defaultValue: Partial<T> | undefined,
    schemaValidator?: {
        schema: U,
        validator: IJsonPrtFormValidator<U, V>
    },
    postValidator?: (values: T, errors: { [path: string]: V }) => Promise<{ [path: string]: V }>,
    options?: {
        /** When not using JsonPtrFormControls set it to async. Causes a second render. */
        async?: boolean,
        /** Do some pre cleaning on the values to be validated */
        validatePreClean?: CleanOptions,
        /** Return the full error. default is to return only the error message */
        fullError?: boolean
    },
    deps: DependencyList = []) => {

    const formStore = useStore();
    const [, setRender] = useState(() => ({}));
    const [values, setValues] = useState<T>({} as any);
    const [errors, setErrors] = useState<{ [path: string]: IPrtFormError }>({});
    const [touched, setTouched] = useState<{ [ptr: string]: boolean }>({});

    useEffect(() => {

        setTouched({});
        setValues({} as any);
        setErrors({});
        formStore.set([{ ptr: '/', value: cloneJson<Partial<T> | undefined>(defaultValue) }]);
        if (schemaValidator)
            schemaValidator.validator.addSchema(schemaValidator.schema).catch(err => console.log(err));

        const sub = formStore.get<T>('/')
            .pipe(
                tap(_ => {
                    if (options?.async)
                        setRender({});
                }),
                switchMap(value => combineLatest([
                    of(value),
                    schemaValidator ?
                        from(schemaValidator.validator.validateSchema(
                            schemaValidator.schema.tag,
                            options?.validatePreClean ?
                                removeDeepUndefined(value, options.validatePreClean) :
                                value)) :
                        of({})
                ]))
            )
            .subscribe(([value, errors]) => {
                if (postValidator)
                    postValidator(value!, errors)
                        .then(errs => {
                            setValues({ ...value! });
                            setErrors(Object.assign(errs, errors as any));
                        })
                        .catch(_ => {
                            setValues({ ...value! });
                            setErrors(errors);
                        });
                else {
                    setValues({ ...value! });
                    setErrors(errors);
                }
            });

        return () => {
            schemaValidator?.validator?.removeSchema(schemaValidator.schema.tag).catch(err => console.log(err));
            sub.unsubscribe();
        }

    }, [defaultValue, schemaValidator?.schema, schemaValidator?.validator, postValidator, options, ...deps]);

    /**
     * Remove a value via ptr.
     * Remove the touch ptr and all its children.
     */
    const removeValue = useCallback((ptr: string) => {

        if (!ptrHas(formStore.slice('/'), ptr)) return;
        setTouched(touched => removePtrEntries(touched, ptr));
        formStore.del([ptr]);

    }, [formStore, setTouched]);

    /**
     * Set the new value.
     * Removes all missing touch child ptrs.
     * @param value 
     * @param ptr 
     */
    const setValue = (value: any, ptr: string) => {

        const touchedObj = diffPtrEntries(ptr, formStore.slice(ptr), value, touched);
        if (touchedObj !== touched)
            setTouched(touchedObj);

        formStore.set([{ ptr, value }]);

    }

    /**
     * Reset a value.
     * Removes touch ptrs for a ptr and its children.
     * Set the value to the provided value or the default value or undefined.
     * @param value 
     * @param ptr 
     */
    const resetValue = (value: any, ptr: string) => {
        setTouched(touched => {
            const _touched = removeChildPtrEntries(touched, ptr);
            delete _touched[ptr];
            return _touched;
        });
        formStore.set([{ ptr, value: value || defaultValue }]);
    }

    /**
     * Provide a new reference for an array or object literal
     * @param ptr The ptr to the value
     */
    const rerefValue = (ptr: string) => {
        const value = formStore.slice(ptr);
        if (isArray(value))
            formStore.set([{ ptr, value: [...value] }]);
        else if (isPlainObject(value))
            formStore.set([{ ptr, value: { ...value } }]);
    }  

    /**
     * Sets touch ptrs for a ptr.
     * If no ptr is provided sets touch ptrs for all ptrs.
     * @param ptr 
     */
    const setTouchedFn = (ptr?: string) => {

        setTimeout(() => {
            if (!ptr) {
                setTouched(touched => ({
                    ...objectMap(errors, () => true),
                    ...listPointers(formStore.slice('/'), true),
                    ...listPointers(defaultValue, true),
                    ...touched
                }));
            }
            else if (!touched[ptr])
                setTouched(touched => ({ ...touched, [ptr]: true }));

        }, 0);

    }

    const res: any = {
        valid: (ptr?: string) => ptr ? !errors[ptr] : !Object.keys(errors).length,
        values,
        value: <T>(ptr: string, clean?: CleanOptions) => removeDeepUndefined<T | undefined>(formStore.slice(ptr) as T, clean),
        setValue,
        removeValue,
        errors,
        error: (ptr: string) => options?.fullError ? errors[ptr] : errors[ptr]?.message,
        touched: (ptr: string) => !!touched[ptr],
        setTouched: setTouchedFn,
        dirty: (ptr?: string) => !deepEqual(formStore.slice(ptr || '/'), ptrGet(defaultValue, ptr || '/')),
        resetValue,
        rerefValue
    }

    res.form = res;

    return res as IJsonPtrFormResult<T, W> & { form: IJsonPtrFormResult<T, W> };

}