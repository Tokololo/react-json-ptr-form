
# What is react-json-ptr-form?
React-json-ptr-form is a [rxjs](https://www.npmjs.com/package/rxjs) react form manager that uses [json-ptr-store](https://www.npmjs.com/package/@tokololo/json-ptr-store) to manage form state. Form state is set and retrieved via [json pointers](https://datatracker.ietf.org/doc/html/rfc6901). It is intuitive, minimalist yet powerful.
> Please look at documentation for [json-ptr-store](https://github.com/Tokololo/json-ptr-store#readme).  
> For the latest documentation please consult the repo  [readme](https://github.com/Tokololo/react-json-ptr-form#readme).  
> If you like react-json-ptr-form also have a look at [react-json-ptr-store](https://github.com/Tokololo/react-json-ptr-store#readme).
# How to use
## useJsonPtrForm
The form manager has the following interface:

    const { 
      value, 
      values, 
      setValue, 
      removeValue, 
      resetValue,   
      rerefValue,  
      error, 
      errors, 
      errorCount,  
      touched, 
      setTouched,       
      valid, 
      dirty, 
      form        
    } = useJsonPtrForm<T, ISchema, IPrtFormError>(
      defaultValues: Partial<T> | undefined,
      schemaValidator?: {
	    schema: ISchema,
	    validator: IJsonPrtFormValidator<T, ISchema, IPrtFormError>
      },
      postValidator?: (
        values: T, 
        errors: { [path: string]: IPrtFormError[] }
      ) => Promise<{ [path: string]: IPrtFormError[] }>,
      options?: {
	    async?: boolean,  
	    validatePreClean?: CleanOptions
      },
      deps: DependencyList = []);
The internal dependency list is set as follows:

    [
      defaultValue,  
      schemaValidator?.schema,  
      schemaValidator?.validator,  
      postValidator,  
      options, 
      ...deps
    ]

so please take care to provide static instances between renders, ie by wrapping these values in useMemo, useEffect or useCallback. Refer to the full example at the end.
 
The parameters are as follows:
### defaultValues
    defaultValues: Partial<T> | undefined
The default value of the form state
### schemaValidator
    schemaValidator?: {
      schema: ISchema,
      validator: IJsonPrtFormValidator<T, ISchema, IPrtFormError>
    }
You provide a schema-validator via a schema and a validator. The schema is specific to the form you are managing and the validator can be created just for the form or it can be long-lived beyond the lifetime of the form.
The schema needs an identifying tag. The rest of the properties are up to the schema validator.

    interface ISchema {
      tag: string
    }

The schema validator has the following interface:

    interface IJsonPrtFormValidator<
      T,  
	  U extends ISchema = ISchema,
	  V extends IPrtFormError = IPrtFormError> { 
	    addSchema(schema: U): Promise<void>;
	    validateSchema(tag: string, value: T): Promise<{ [ptr: string]: V[] }>;
	    removeSchema(tag: string): Promise<void>;
    }
`validateSchema` returns an error object the keys of which are the json pointers of the values that failed validation. For  instance if you send in the following value object:

    {
      my: {
        notes: [{
	      heading: 5,
	      text: 'some text' 
        }]
      }
    }
the error object might look like this:

    {
      '/my/notes': { type: 'minItems', expected: 4, message: 'Please enter at least 4 items' },
      '/my/notes/0/heading': { type: 'invalidType', expected: "string", message: 'Heading must be a string' }
    }
### postValidator

    postValidator?: (  
      values: T,  
      errors: { [path: string]: V[] }
    ) => Promise<{ [path: string]: V[] }>
The post validator is used for:

 - the rare cases in which the schema validator is unable to provide the complex validation needed
 - as your main validation entry if you do not want to write a custom schema validator

It receives the values to be validated and the errors from the schema validator and must return the complete error object. The important take-away is that the return error object is indexed by ptr strings exactly in the same format that the schema validator returns it in. Note that if you do not have a schema validator the postValidator will receive an empty error object.
### options
Options control the behavior of the form manager. Currenty there are two properties:

    async?: boolean
Set this only in the rare cases of using the form manager without the JsonPtrFormControl renderer. Setting this value introduces an extra render needed to manage input field asynchronous updates which is due to the asynchronous nature of the validation. Using the preferred JsonPtrFormControl renderer takes care of this under the hood in a more performant and flexible way.

    validatePreClean?: CleanOptions,
Set this is you need some pre-cleaning of the form values you are sending to the validator. For instance, one of the child objects in your form state might have all undefined yet required values. Leaving it as is will cause the validator to error each of the required properties. If you pre-clean it the child object will itself be removed from the form opject and if the child object is not required validation will pass. Pre-cleaning is just a convenience for not manually removing the child object within the form logic.
### deps
    deps: DependencyList = []

You can reset the form manager by adding a state variable to the deps dependency list.
## useAjvValidator
react-json-ptr-form comes with one predefined validator based on [ajv](https://ajv.js.org/) that uses [json schema](https://json-schema.org/) validation: 

    useAjvValidator: <T extends { [prop: string]: any; } = {}>(
      opts?: Options, 
      plugins?: {  
        ajvFormats?: boolean;  
        ajvErrors?: boolean;  
    }) => IJsonPrtFormValidator<T, IAjvSchema, IAjvError>

If you do not specify [opts](https://ajv.js.org/options.html) it will default to {  allErrors: true }.   
The following plugins can be enabled: [ajv-formats](https://ajv.js.org/packages/ajv-formats.html) and [ajv-errors](https://ajv.js.org/packages/ajv-errors.html).

It is used like this in your React functional code:

    const validator = useAjvValidator(undefined, { ajvFormats: true });

This will either create the singleton instance or return it if it has already been created. You can also create it outside of your React functional code which allows you to add [auxiliary schemas](https://cswr.github.io/JsonSchema/spec/definitions_references/), the same options as for useAjvValidator as well as to pass in your own Ajv instance:

    createAjv: (
      schemas?: IAjvSchema[], 
      opts?: Options, 
      plugins?: {  
        ajvFormats?: boolean;  
        ajvErrors?: boolean;  
      }, 
      ajv?: Ajv) => void

You instantiate it like this:

    createAjv(
      [auxSchema1, auxSchema2], 
      undefined, 
      { ajvFormats: true, ajvErrors: true }
    );


The ability to pass in your own Ajv instance allows you to configure it with additional [plugins](https://ajv.js.org/packages/) beyond the defaults available.  Please note that if you pass in your own instance the above opts and plugins are ignored. 

Whether you pass in your own Ajv instance or use the default there will always just be a single instance, hence any opts and plugins you pass in are only applied on the first initialisation.
## useJsonPtrForm return value
useJsonPtrForm returns an object with properties to mostly functions that you use to access the form manager functionality.
### value
    value: <T>(ptr: string) => T | undefined
Returns the form value at ptr.
### values
     values: T
The form values object literal
### setValue
    setValue: (value: any, ptr: string) => void
Call this to set a new value at the provided ptr. You can set both scalar and complex values. If the ptr path does not exist it will be created. You can append values to an array or set values at non-existing index in an array. Refer to json pointer syntax.
### removeValue
    removeValue: (ptr: string) => void
Use this to remove a value at a ptr.
### resetValue
    resetValue: (value: any, ptr: string) => void
Use this to reset the value to a default and to clear all touched flags for the value at the ptr as well as for any child values rooted further down the pointer. If the provided value is undefined it defaults to the value provided when the store was first inititalised.
### rerefValue
    rerefValue: (ptr: string) => void
Use this to set a new reference for an array or object literal at the ptr in your form state. If the type of the value is not an array of object literal it does nothing.
### error
    error: (ptr: string) => string | undefined
Retrieves the first error message for a ptr. If you need all the error objects for a ptr please use `errors` below.
### errors
    errors: { [ptr: string]: IPrtFormError[]; }
An object literal of all the error objects indexed by ptr.
### errorCount
    errorCount: (ptr: string) =>  number;
Retrieves the total number of errors for a ptr.
### touched
    touched: (ptr?: string) => boolean;
Call this to determine if the form value at a provided ptr (which includes the child values further down the ptr) has been touched. If you omit ptr it will give you the touched status of the form as a whole which is equivalent to touched('/'). 
### setTouched
    setTouched: (ptr?: string) => void
Call this to set the touch status of a form value at a provided ptr only. If you omit ptr you set the touched flag on every value in your form. Setting the touch status of a ptr does not automatically set the touch status of child ptrs further down, hence setTouched() is not equavalent to setTouched('/').
### valid
    valid: (ptr?: string) => boolean
Call this to determine if the form value at a provided ptr (which includes the child values further down the ptr) is valid. If you omit ptr it will give you the valid status of the form as a whole which is equivalent to valid('/'). Do not rely on the valid status of ptrs that your validation does not manage. For instance, you might have a child object for which the validation schema only requires it to be an object. If you request the valid status of a property on this child object it will be meaningless.
### dirty
    dirty: (ptr?: string) => boolean;
Call this to determine if the form value at a provided ptr (which includes the child values further down the ptr) is dirty. If you omit ptr you get the dirty state of the form as a whole which is equivalent to dirty('/'). Passing it a ptr to a leaf node in the form state is fast and passing it a prt to a root node of the form state is slower.
### form
    form: {
      valid: (ptr?: string) => boolean,  
      value: <W>(ptr?: string) => W | undefined,  
      setValue: (val: any, ptr?: string) => void,  
      removeValue: (ptr?: string) => void,  
      resetValue: (value: any, ptr?: string) => void,  
      rerefValue: (ptr?: string) => void,  
      error: (ptr?: string) => string | undefined, 
      errorCount: (ptr?: string) => number,  
      touched: (ptr?: string) => boolean,  
      setTouched: (ptr?: string) => void,  
      dirty: (ptr?: string) => boolean  
    }
Used with JsonPtrFormControl.
## JsonPtrFormControl
JsonPtrFormControl is the preferred way to wrap form fields/controls. 

    JsonPtrFormControl: <T, V extends IPrtFormError = IPrtFormError>(props: IJsonPtrFormControl<T, V>) => JSX.Element
###
props has the following definition:

    interface IJsonPtrFormControl<T, V extends IPrtFormError = IPrtFormError> { 
      slot?: string,  
      ptr: string,  
      form: IJsonPtrFormResult<T, V>,  
      render: (args: IJsonPtrFormControlRender) => JSX.Element
    }

It takes 4 properties:

 - slot: Optional slot used by various UI frameworks
 - ptr: The ptr to the form element's state within the form state
 - form: The form object returned by useJsonPtrForm 
 - render: A render method for the form control

The render method has the following definition:

    interface IJsonPtrFormControlRender {
      valid: (ptr?: string) => boolean,
      value: <W>(ptr?: string) => W | undefined,
      setValue: (val: any, ptr?: string) => void,
      removeValue: (ptr?: string) => void,
      resetValue: (value: any, ptr?: string) => void,  
      rerefValue: (ptr?: string) => void,  
      error: (ptr?: string) => string | undefined,
      errorCount: (ptr?: string) => number,  
      touched: (ptr?: string) => boolean,
      setTouched: (ptr?: string) => void,
      dirty: (ptr?: string) => boolean
    }

It is used like this:

    const { form } = useJsonPtrForm<IArticle, IAjvSchema, IAjvError>(default_values);
    
    <JsonPtrFormControl
      ptr='/title'    
      form={form}    
      render={({ value, setValue, error, touched, setTouched }) =>    
      <ListInput    
        label='Title'    
        type='text' 
        value={value<string>() || ''}    
        onChange={(e) => setValue(e.target.value)}    
        onBlur={() => setTouched()}    
        onInputClear={() => setValue(undefined)}    
        errorMessage={error()?.schemaPath}    
        errorMessageForce={touched()} />} />


The render properties mirrors the return value of useJsonPtrForm with the difference that the ptr parameter is optional.  
It has the following benefits:

 - It takes care of async issues 
 - It is performant 
 - It provides convenience

You provide JsonPtrFormControl with the ptr only once and it provides many of the same functions useJsonPtrForm provides but with greater convenience. As stated most of these functions take an optional ptr. If you do not provide the ptr it is defaulted to the ptr set on JsonPtrFormControl yet you can still provide a ptr in order to access other parts of the form state. You are also not limited to the use of these functions and are free to use the functions useJsonPtrForm provides within the scope of JsonPtrFormControl.

## Arrays
Rendering array form elements are extremely easy:

    {
      value<string[]>('/options')?.map((option, idx) =>
	    <JsonPtrFormControl
	      key={idx}
	      ptr={`/options/${idx}`}
	      form={form}
	      render={({ value, setValue, error, touched, setTouched }) =>
	        <ListInput
	          label={`Option ${idx + 1}`}
	          type='text'
	          value={value<string>() || ''}
	          onChange={(e) => setValue(e.target.value)}
	          onBlur={() => setTouched()}
	          onInputClear={() => setValue(undefined)}
	          errorMessage={error()}
	          errorMessageForce={touched()}
	    />} />)
    }
To append an array item to the above options list you can do as follows:

    () => {
        setValue("Cheese", '/options/-');  
    }
  
To remove the 4th item in the above options array you do the following:

    () => {
        removeValue("/options/3");  
    }
If for some reason you need to provide a new array reference you can do as follows:

    () => {  
        setValue("Cheese", '/options/-');  
        rerefValue('/options');
    }
or if you prefer to do it manually: 

    () => {  
        const options = value<string[]>('/options') || [];
        setValue([...options, "Cheese"], '/options'); 
    }
Why would you want to provide a new reference?

In the above `setValue("Cheese", '/options/-')` you appended a value to an array. If the array already existed no new reference is provided. The form will still rerender with the new correct values but dependent form controls might not render correctly. Let's imagine you have a select list that internally has a useMemo hook with a dependency list for its options and you pass `value('/options')` to it. If you `setValue("Cheese", '/options/-')` the altered array will still be passed to it but it will not rerun its useMemo hook as the dependency list detected no change.

## Submit a form
You are in complete control of how to submit your form. A practical example is as follows:

    const { valid, form, values, setTouched } = useJsonPtrForm(
      defaultValues, 
      useValidator(getSchema)
    );
    
    const submit = () => {  
      if (!valid()) 
        setTouched();
      else  
        submitForm(values); 
    }
 
    <Button onClick={submit}>Submit</Button>

## Convenience functions
### cleanDeepPtrs

    cleanDeepPtrs: <T>(source: T, ptrs: string[], options?: CleanOptions) => T

Allows you to deep clean your form value before you send it to the backend.
Parameters are:

 - source: T 
 - ptrs: string[]
 - options?: CleanOptions

If you do not provide options it defaults to:

    {
      emptyArrays: true,  
      emptyObjects: true,  
      emptyStrings: true,  
      NaNValues: false,  
      nullValues: true,  
      undefinedValues: true  
    }
It returns a new object with all the values at the provided ptr array cleaned.
You would most likely use this if you set the `validatePreClean` option in your form manager.

## Complete example

    
    const getSchema = (): IAjvSchema => { 
	  return {
	    tag: 'ui_test',
	    schema: {
	      $schema: "http://json-schema.org/draft-07/schema#",
	      $id: "http://my-test.com/schemas/ui_test.json",
	      type: "object",
	      properties: {
	        title: {type: "string" },
	        body: {
	          type: "object",
	          properties: {
	            header: { type: "string" },
	            footer: { type: "string" }
	          },
	          required: ["header", "footer"]
	        }
	      },
	      required: ['title', "body"]
	    } 
	  }
    }
        
    interface IArticle {
	  title?: string,
	  body?: {
	    header?: string,
	    footer?: string
	  }
    } 
    
    const getDefaultValue = (article?: IArticle): IArticle => { 
	  return article ?
	  {
	    ...article
	  } :
	  {
	    title: undefined,
	    body: {
	      header: undefined,
	      footer: undefined
	    }
	  };     
    } 
    
    const TestPage = () => { 
    
	  const validator = useAjvValidator();
	  
	  const schema = useMemo(() => getSchema(), []);  
	  
	  const defaultValues = useMemo(() =>  
	    getDefaultValue({ 
	      body: { 
	        footer: 'my footer', 
	        header: 'my header' 
	      }, 
	      title: 'Hello' 
	    }), []);
	    
	  const postValidator = useCallback(async(
	    values: IArticle,  
	    errors: { [ptr: string]: IAjvError[] }  
	  ) => {
	    if (values.title?.toLowerCase().startsWith('my') {
	      errors['/title'] = errors['/title'] || [];
	      errors['/title'].push({
	        instancePath: "/title",
	        keyword: "errorMessage",
	        message: "may not start with 'my'",
	        schemaPath: "#/properties/title/errorMessage"
	      });
	    return errors;	    
	  }, []);  
	    
	  const { 
	    setValue, 
	    setTouched, 
	    touched,
	    valid, 
	    values, 
	    form, 
	    dirty, 
	    errors 
	  } = useJsonPtrForm<IArticle, IAjvSchema, IAjvError>(
	    defaultValues,
	    {
	      schema,
	      validator
	    },
	    postValidator);  
	    
	  const submit = () => {
	    sendToMyServer(cleanDeepPtrs(values, ['/'])).then(...)
	  }    
	  
	  return (
	    <Page className="popup-tablet-fullscreen">
	      <Navbar
	        title="My Test"
	        backLink="Back">
	        <NavRight>
	          <SubmitLink
	            valid={valid()}
	            onClick={() => {
	              if (valid())
	                submit();
	              else
	                setTouched();
	            } />
	        </NavRight>
	      </Navbar>	    
	      <List>
	        <JsonPtrFormControl
	          ptr='/title'
	          form={form}
	          render={({ value, setValue, error, touched, setTouched }) =>
	            <ListInput
	              label='Title'
	              type='text'
	              value={value<string>() || ''}
	              onChange={(e) => setValue(e.target.value)}
	              onBlur={() => setTouched()}
	              onInputClear={() => setValue(undefined)}
	              errorMessage={error()}
	              errorMessageForce={touched()}
	        />} />	    
	        <JsonPtrFormControl
	          ptr='/body/header'
	          form={form}
	          render={({ value, setValue, error, touched, setTouched }) =>
	            <ListInput
	              label='Header'
	              type='textarea'
	              resizable
	              value={value<string>() || ''}
	              onChange={(e) => setValue(e.target.value)}
	              onBlur={() => setTouched()}
	              onInputClear={() => setValue(undefined)}
	              errorMessage={error()}
	              errorMessageForce={touched()}
	        />} />	    
	        <JsonPtrFormControl
	          ptr='/body/footer'
	          form={form}
	          render={({ value, setValue, error, touched, setTouched }) =>
	            <ListInput
	              label='Footer'
	              type='textarea'
	              resizable
	              value={value<string>() || ''}
	              onChange={(e) => setValue(e.target.value)}
	              onBlur={() => setTouched()}
	              onInputClear={() => setValue(undefined)}
	              errorMessage={error()}
	              errorMessageForce={touched()}
	        />} />
	      </List>
	   </Page>);
    };
# Change Log
## version 2.1.0
 - Make ptr parameter optional for touched() on useJsonPtrForm
 - valid() to return the valid status for the ptr as well as any child ptrs further down for both useJsonPtrForm and JsonPtrFormControl
 - touched() to return the touched status for the ptr as well as any child ptrs further down for both useJsonPtrForm and JsonPtrFormControl
 - Added the convenience function cleanDeepPtrs()
## version 2.0.3
 - Fixed a bug on resetValue
## version 2.0.2
 - Fixed the dirty flag from reporting true whilst the form is initialising
## version 2.0.1
 - Fixed bug where in very rare circumstances postValidator errors may be overwritten.
## version 2.0.0
 - add ajv-errors to package.json
 - removed option fullError
 - altered the schema validator validateSchema to return an array of errors for each error ptr
 - altered the postValidator signature to receive an array of errors for each error ptr and return an array of errors for each error ptr
 - removed second parameter `clean?: CleanOptions` from value property on useJsonPtrForm return value
 - removed second parameter `clean?: CleanOptions` from JsonPtrFormControl render  properties
 - alter error property on useJsonPtrForm return value to return string | undefined
 - alter error property on JsonPtrFormControl render properties to return string | undefined
 - alter errors property on useJsonPtrForm return value to return an array of error objects for each error
 - added property errorCount to useJsonPtrForm return value properties
 - added property errorCount to JsonPtrFormControl render  properties
 - altered useAjvValidator to set options and plugins
 - altered createAjv to set options, plugins and an instance of Ajv
## version 1.0.8
 - Add rerefValue to JsonPtrFormControl and useJsonPtrForm
## version 1.0.7
 - Update json-ptr-store to version 1.1.5 which removed undefined set limitation
