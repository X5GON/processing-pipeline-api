/** **********************************************
 * JSON Validator Module
 * This module stores different JSON schemas
 * provided by the user and validates the
 * JSON objects.
 */

// interfaces
import * as Interfaces from "../Interfaces";

// modules
import * as jsonschema from "jsonschema";


export default class Validator {

    private _validator: jsonschema.Validator;

    public schemas?: Interfaces.IValidatorSchemas;

    // initialize the JSON validator
    constructor(schemas?: Interfaces.IValidatorSchemas) {
        let self = this;
        // save the JSON validator
        self._validator = new jsonschema.Validator();
        // the json schemas used to validate
        self.schemas = schemas;
    }


    // object validaton function
    validateSchema(instance: any, schema: jsonschema.Schema) {
        let self = this;
        let validation = self._validator.validate(instance, schema);
        return {
            isValid: validation.valid,
            errors: validation.errors,
            message: validation.toString()
        };
    }


    // integer validation function
    validateInteger(instance: any) {
        return Number.isInteger(instance) ? true : false;
    }
}
