/** **********************************************
 * User Models Update Module
 * This module exports the function used for
 * updating the user model using the provided
 * user activity data.
 */

// configurations
import config from "../config/config";

// modules
import PostgreSQL from "./postgresQL";

// internal modules
const pg = new PostgreSQL(config.pg);

// get postgres schema
const schema = config.pg.schema;

// Copies attributes from the second object to the first one
function addObjects(objectA: any, objectB: any) {
    for (let c in objectB) {
        if (objectA.hasOwnProperty(c)) {
            objectA[c] += objectB[c];
        } else {
            objectA[c] = objectB[c];
        }
    }
    return objectA;
}

// Multiplies attributes of the provided object with the provided value.
function multiplyObjects(objectA: any, num: number) {
    for (let c in objectA) {
        objectA[c] *= num;
    }
    return objectA;
}


// updates a user model using the provided activity data
export default async function updateUserModel(activity: { uuid: string, urls: string[] }) {

    // extract activity data
    const {
        uuid,
        urls
    } = activity;

    try {
        const user_model = await pg.execute(`SELECT * FROM ${schema}.rec_sys_user_model WHERE uuid='${uuid}';`, []);

        // escape the provider uri and query for material models
        let escapedUris = urls.map(url => url.replace("'", "''"));

        // get the user model
        let user = user_model.length !== 0
            ? user_model[0]
            : {
                uuid: activity.uuid,
                language: { },
                visited: {
                    count: 0
                },
                type: { },
                concepts: { }
            };

        const material_models = await pg.execute(`SELECT * FROM ${schema}.rec_sys_material_model WHERE provider_uri SIMILAR TO '%(${escapedUris.join("|")})%'`, []);

        // get or create user model
        for (let material of material_models) {
            // check if the user has visited the material before
            if (material && user) {
                if (user.visited.hasOwnProperty(material.provider_uri)) {
                    // user has already seen the material - nothing to do
                    user.visited[material.provider_uri] += 1;
                    continue;
                }
                // if user has not seen the material
                const count = user.visited.count;

                let concepts = JSON.parse(JSON.stringify(user.concepts)); // copy concepts object
                concepts = multiplyObjects(concepts, count);
                concepts = addObjects(concepts, material.concepts);
                concepts = multiplyObjects(concepts, 1 / (count + 1));
                user.concepts = concepts;

                // update visited count and url
                user.visited[material.provider_uri] = 1;
                user.visited.count += 1;

                // update the type profile of the user
                if (!user.type.hasOwnProperty(material.type)) {
                    user.type[material.type] = 0;
                }
                user.type[material.type] += 1;

                // update the language profile of the user
                if (!user.language.hasOwnProperty(material.language)) {
                    user.language[material.language] = 0;
                }
                user.language[material.language] += 1;
            }
        }
        // insert or update the user model to the database
        await pg.upsert(user, { uuid: null }, `${schema}.rec_sys_user_model`);

    } catch (error) { }
}

