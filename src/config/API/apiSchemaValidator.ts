import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'path';

const FgRed = '\x1b[31m';
const Reset = '\x1b[0m';

const ajv = new Ajv({
    allErrors: true,
    strict: false
});

addFormats(ajv);

export class SchemaValidator {

    static validate(schemaRef: string, schemaKey: string, responseBody: unknown): void {

        const filePath = path.resolve(__dirname, '../../test/data/API/schemas', `${schemaRef}.json`);

        if (fs.existsSync(filePath)) {

            const schema = JSON.parse(
                fs.readFileSync(filePath, 'utf-8')
            )[schemaKey];

            const validate = ajv.compile(schema);

            const valid = validate(responseBody);

            if (!valid) {
                throw new Error(
                    `${FgRed}Validacion del esquema fallo:\n ${JSON.stringify(validate.errors, null, 2)}${Reset}`
                );
            }
        } else {
            throw new Error(`${FgRed}Esquema no fue encontrado en la ruta: ${filePath}${Reset}`);
        }
    }
}