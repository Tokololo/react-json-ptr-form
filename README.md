
# What is react-json-ptr-form?
React-json-ptr-form is a react form manager that uses react-json-ptr-store  to manage form state. Form state is set and retrieved via json pointers. It is intuitive, minimalist yet powerful.
> Please look at documentation for [json-ptr-store](https://github.com/Tokololo/json-ptr-store)  
# How to use
## Creating the form manager
The form manager has the following interface:

    const { value, setValue, error, touched, setTouched, removeValue, valid, values, form, dirty, errors, resetValue } = useJsonPtrForm<T, ISchema, IPrtFormError, IPrtFormError>(
    defaultValues: Partial<T> | undefined,
    schemaValidator?: {
	    schema: ISchema,
	    validator: IJsonPrtFormValidator<ISchema, IPrtFormError>
    },
    postValidator?: (values: T, errors: { [path:  string]: IPrtFormError }) => Promise<{ [path:  string]: IPrtFormError }>,
    options?: {
	    async?: boolean,
		validatePreClean?: CleanOptions,
	    fullError: boolean	    
    },
    deps: DependencyList = []);
The internal dependency list is set as follows:
 `[defaultValue, schemaValidator?.schema, schemaValidator?.validator, postValidator, options, ...deps]` 
 so **please take care to provide static instances between renders**, ie by wrapping these values in **useMemo()**. Refer to the full example at the end.
 
The parameters are as follows:
### defaultValues
    defaultValues: Partial<T> | undefined
The default value of the form state
### schemaValidator
    schemaValidator?: {
    	schema: ISchema,
    	validator: IJsonPrtFormValidator<ISchema, IPrtFormError>
    }
You provide a schema-validator via a schema and a validator. The schema is specific to the form you are managing and the validator can be a pre-created/long-lived that contains other form schemas or definitions.
The schema needs an identifying tag. The rest of the properties are up to the schema validator.

    interface ISchema {
    	tag: string
    }

The schema validator has the following interface:

    interface IJsonPrtFormValidator<
	    U extends ISchema = ISchema,
	    V extends IPrtFormError = IPrtFormError> { 
		    addSchema(schema: U): Promise<void>;
		    validateSchema(tag: string, value: any): Promise<{ [ptr: string]: V }>;
		    removeSchema(tag: string): Promise<void>;
    }
validateSchema returns an error object the keys of which are the json pointers of the values that failed validation. For  instance if you send in the following value object:

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
	
react-json-ptr-form comes with one predefined validator based on [ajv](https://ajv.js.org/) that uses [json schema](https://json-schema.org/) validation: 

    const validator = useAjvValidator();

You can also instantiate it's singleton instance somewhere else in your app before use:

    createAjv([schemadefinition1, schemadefinition2];
    ...
    const validator = useAjvValidator();

### postValidator

    postValidator?: (values: T, errors: { [path:  string]: V }) => Promise<{ [path:  string]: V }>
The post validator is used for the rare cases in which the schema validator is unable to provide the complex validation needed. It receives the values to be validated and the errors from the schema validator and must return the complete error object. You can also use it as a quick and dirty validator for small forms if you want. The important take-away is that the return error object is indexed by ptr strings.
### options
Options control the behavior of the form manager. Currenty there are three properties:

    async?: boolean
Set this only in the rare cases of using the form manager without the JsonPtrFormControl renderer. Setting this value introduces an extra render needed to manage input field asynchronous updates which is due to the asynchronous nature of the validation. Using the preferred JsonPtrFormControl renderer takes care of this under the hood in a more performant and flexible way.

    validatePreClean?: CleanOptions,
Set this is you need some pre-cleaning of the form values you are sending to the validator. For instance, one of the child objects in your form state might have all undefined yet required values. Leaving it as is will cause the validator to error each of the required properties. If you pre-clean it the child object will itself be removed from the form opject and if the child object is not required validation will pass. Pre-cleaning is just a convenience for not manually removing the child object within the form logic.

    fullError?: boolean

By default only the error message is returned to the error of the control. Set this to return the complete object.
## deps
    deps: DependencyList = []

You can reset the form manager by adding a state variable to the deps dependency list.
## useJsonPtrForm return value
useJsonPtrForm returns an object with properties to mostly functions that you use to access the form manager functionality.
### valid
    valid: (ptr?: string) => boolean
You call this function with a ptr to a form value. If you leave ptr empty it will give you the valid status of the form as a whole. Do not rely on values of ptrs that access values which the store does not manage. For instance, you might have a child object for which the validation schema only requires it to be an object. If you request the valid status of a property on this child object it will be meaningless.
### values
     values: T
The form values
### setValue
    setValue: (value: any, ptr: string) => void
Call this to set a new value at the provided ptr. As it is using json pointers you can set a current value to something new or add a value at a non-existing object/array path. You don't only need to set scalar values. You can set complex objects as well, append to arrays etc. Refer to json pointer syntax.
### removeValue
    removeValue: (ptr: string) => void
Use this to remove a value at a ptr.
### resetValue
    resetValue: (value: any, ptr: string) => void
Use this to either set a new value at a ptr, set the default value (as per the defaultValue provided to the store) or as undefined. In addition it clears all touched flags for the value at the ptr as well as for any child values rooted further down the pointer.
### errors
    errors: { [path: string]: IPrtFormError; }
This is an object literal of all the errors, the keys of which are the json ptrs. To retrieve an error for a specific field just provide the ptr at which the field resides.
### error
    error: (ptr: string) => string | IPrtFormError | undefined
Retrieve an individual error for a ptr. By default it returns the error message but you can return the complete error object via the options setting **fullError**
### touched
    touched: (ptr: string) => boolean;
Call this to find out if the field at a provided ptr has been touched
### setTouched
    setTouched: (ptr?: string) => void
Call this to mark a field at a provided ptr as touched. If you omit ptr you set the touched flag on every value in your form.
### dirty
    dirty: (ptr?: string) => boolean;
Call this to determine if the field at the provided ptr is dirty. If you omit prt you get the dirty state of the form as a whole. Passing it a ptr to a leaf node in the form state is fast and passing it a prt to a root node of the form state is slower.
## JsonPtrFormControl
JsonPtrFormControl is the preferred way to wrap form fields/controls. It is used like this:


    const { form } = useJsonPtrForm<IArticle, IAjvSchema, IAjvError, IAjvError>(default_values);
    
    <JsonPtrFormControl
    	ptr='/title'    
    	form={form}    
    	render={({ value, setValue, error, touched, setTouched }: IJsonPtrFormControlRender<IAjvError>) =>    
    	<ListInput    
    	    label='Title'    
    	    type='text' 
    	    value={value<string>() || ''}    
    	    onChange={(e) => setValue(e.target.value)}    
    	    onBlur={() => setTouched()}    
    	    onInputClear={() => setValue(undefined)}    
    	    errorMessage={error()?.schemaPath}    
    	    errorMessageForce={touched()} />} />
It takes 3 parameters:

 - ptr: The ptr the control's state within the form state
 - form: The form object returned by useJsonPtrForm 
 - render: A render method for the control

It returns the following interface:

    interface IJsonPtrFormControlRender<V extends string | IPrtFormError = string> {
    	valid: (ptr?: string) => boolean,
    	value: <W>(ptr?: string, clean?: CleanOptions) => W | undefined,
    	setValue: (val: any, ptr?: string) =>  void,
    	removeValue: (ptr?: string) => void,
    	resetValue: (value: any, ptr?: string) => void,
    	error: (ptr?: string) => V | undefined,
    	touched: (ptr?: string) => boolean,
    	setTouched: (ptr?: string) => void,
    	dirty: (ptr?: string) => boolean
    }

It mirrors the return value of useJsonPtrForm with the difference that the ptr parameter is optional.
It has the following benefits:

 - It takes care of async issues 
 - It is performant 
 - It provides convenience

You provide it with the ptr only once and it brings many of the same functions the form manager provides but with greater convenience. Most of these functions take an optional ptr. If you do not provide it it is defaulted to the ptr set on JsonPtrFormControl yet you can still provide a ptr to access other parts of the form state.
The functions provided by JsonPtrFormControl are scoped to JsonPtrFormControl but as explained can access other form state as well. Inside the wrapped scope of JsonPtrFormControl you should only use the functions it provides. Outside of that scope you are free to use the functions provided by useJsonPtrForm. You can for instance use it in callback code, hooks etc. which allows for a convenient way to manage your form state.
## Arrays
Rendering array form elements are extremely easy:

    {
	    (value('/options') as string[])?.map((option, idx) =>
	    <JsonPtrFormControl
		    key={idx}
		    ptr={`/options/${idx}`}
		    form={form}
		    render={({ value, setValue, error, touched, setTouched }: IJsonPtrFormControlRender<string>) =>
		    <ListInput
			    label={`Option ${idx + 1}`}
			    type='text'
			    value={value() || ''}
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
	    return  article ?
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
	    const options = useMemo(() => ({
		    fullError: true
	    }), []);
	    const defaultValues = useMemo(() =>  
		    getDefaultValue({ 
			    body: { 
				    footer: 'my footer', 
				    header: 'my header' 
				}, 
				title: 'Hello' 
			}), []);  
	    
	    const { setValue, setTouched, valid, values, form, dirty, errors } = useJsonPtrForm<IArticle, IAjvSchema, IAjvError, IAjvError>(
	    defaultValues,
	    {
		    schema,
		    validator
	    },
	    undefined,
	    options);  
    
	    return (
		    <Page className="popup-tablet-fullscreen">
			    <Navbar
				    title="My Test"
				    backLink="Back">
				    <NavRight>
					    <SubmitLink
						    valid={valid()}
						    on_click={() => setTouched()} />
				    </NavRight>
			    </Navbar>	    
		    <List>
			    <JsonPtrFormControl
				    ptr='/title'
				    form={form}
				    render={({ value, setValue, error, touched, setTouched }: IJsonPtrFormControlRender<IAjvError>) =>
				    <ListInput
					    label='Title'
					    type='text'
					    value={value<string>() || ''}
					    onChange={(e) => setValue(e.target.value)}
					    onBlur={() => setTouched()}
					    onInputClear={() => setValue(undefined)}
					    errorMessage={error()?.message}
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
					    errorMessage={error()?.keyword}
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
					    value={value() || ''}
					    onChange={(e) => setValue(e.target.value)}
					    onBlur={() => setTouched()}
					    onInputClear={() => setValue(undefined)}
					    errorMessage={error()?.message}
					    errorMessageForce={touched()}
			    />} />
		    </List>
		</Page>);
    };
