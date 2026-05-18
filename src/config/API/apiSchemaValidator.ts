import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'path';

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
                    `Validacion del esquema fallo:\n ${JSON.stringify(validate.errors, null, 2)}`
                );
            }
        } else {
            throw new Error(`Esquema no fue encontrado en la ruta: ${filePath}`);
        }
    }
}