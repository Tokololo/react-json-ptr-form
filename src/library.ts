import { cloneDeep, isArray, isEqual, isObject, isPlainObject, mapValues } from "lodash";
import { sortAny } from './sortany';
import { CleanOptions } from "clean-deep";
import cleanDeep from 'clean-deep';
import jsonPtr from 'json-pointer';
import { ptrSet } from "@tokololo/json-ptr-store/dist/library";

const CLEAN_DEEP_OPTS = {
    emptyArrays: true,
    emptyObjects: true,
    emptyStrings: true,
    NaNValues: false,
    nullValues: true,
    undefinedValues: true
}

const sortDeep = (obj: any): any => {

    if (!isArray(obj)) {

        if (!isPlainObject(obj))
            return obj;

        return mapValues(obj, sortDeep);

    }

    return sortAny(obj.map(sortDeep));

};

export const cloneJson = <T>(value: T): T | undefined =>
    typeof value == 'undefined' ?
        undefined :
        cloneDeep<T>(value);

export const objectMap = <T, U>(o: { [prop: string]: T }, f: (prop: string, val: T) => U): { [prop: string]: U } =>
    Object.assign({}, ...Object.keys(o).map(k => ({ [k]: f(k, o[k]) })));

export const removeDeepUndefined = <T>(obj: T, options?: CleanOptions): T =>
    isObject(obj) && options ? cleanDeep(obj, options) as T : obj;

export const deepEqual = (obj1: any, obj2: any) => {

    if (typeof obj1 == 'undefined' && typeof obj2 == 'undefined') return true;
    if (typeof obj1 == 'undefined' || typeof obj2 == 'undefined') return false;

    if (isObject(obj1) && isObject(obj2))
        return isEqual(
            sortDeep(removeDeepUndefined(obj1, CLEAN_DEEP_OPTS)),
            sortDeep(removeDeepUndefined(obj2, CLEAN_DEEP_OPTS)));
    else
        return isEqual(obj1, obj2);

}

export const cleanDeepPtrs = <T>(source: T, ptrs: string[], options?: CleanOptions): T => {

    const src = cloneJson(source) as T;
    ptrs.forEach(ptr => ptrSet(src, ptr, removeDeepUndefined(ptrGet(src, ptr), options || CLEAN_DEEP_OPTS)));
    return src;

}

export const listPointers = <T>(obj: any, val: T) => {

    const dict = jsonPtr.dict(obj);
    const ptrs = Object.keys(dict);
    const dictres: { [ptr: string]: T } = {};

    ptrs.forEach(ptr => {

        const parts = ptr.split('/');
        for (let i = 1; i < parts.length; ++i)
            dictres[parts.slice(0, i + 1).join('/')] = val;

    });

    return dictres;

}


export const ptrGet = <T>(source: any, ptr: string): T | undefined => {

    try {

        return ptr === '/' ?
            source :
            jsonPtr.get(source, ptr);

    }
    catch { return; }

}

export const ptrHas = (source: any, ptr: string) => {

    try {

        return ptr === '/' ?
            typeof source != 'undefined' :
            jsonPtr.has(source, ptr);

    }
    catch { return; }

}