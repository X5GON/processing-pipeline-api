/** ******************************************************************
 * PostgresQL storage process for user activity data
 * This component receives the verified OER material object and
 * stores it into postgresQL database.
 */

// interfaces
import * as Interfaces from "../../Interfaces";

// modules
import BasicBolt from "./basic-bolt";
import updateUserModel from "../../library/user-models";
import PostgreSQL from "../../library/postgresQL";


class StoreUserActivities extends BasicBolt {

    private _pg: PostgreSQL;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: Interfaces.IStoreConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[StoreUserActivities ${this._name}]`;

        // create the postgres connection
        this._pg = new PostgreSQL(config.pg);
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // close connection to postgres database
        await this._pg.close();
    }

    async receive(message: any, stream_id: string) {
        // get sent values
        const {
            uuid,
            url,
            provider,
            referrer: referrer_url,
            visitedOn: timestamp,
            userAgent: user_agent,
            language
        } = message;

        // /////////////////////////////////////////
        // CREATE COOKIES, URLS, USER_ACTIVITIES
        // /////////////////////////////////////////

        // cookie information
        const cookies = {
            uuid,
            user_agent,
            language: language || ""
        };

        // user activities information
        const user_activities = {
            referrer_url,
            timestamp,
            cookie_id: null,
            url_id: null
        };

        try {
            // /////////////////////////////////////////
            // SAVE COOKIES and URLS
            // /////////////////////////////////////////
            // send cookies and urls into the database
            const cookieRecords = await this._pg.upsert(cookies, { uuid: null }, "cookies");

            const providerRecord = await this._pg.select({ token: provider }, "providers");
            const providerID = providerRecord.length === 1 ? providerRecord[0].id : null;
            const urls = { url, ...(providerID && { provider_id: providerID }) };
            const urlRecords = await this._pg.upsert(urls, { url: null }, "urls");

            // /////////////////////////////////////////
            // SAVE USER ACTIVITY DATA
            // /////////////////////////////////////////

            // user activites reference on other records
            user_activities.cookie_id = cookieRecords.length === 1 ? cookieRecords[0].id : null;
            user_activities.url_id = urlRecords.length === 1 ? urlRecords[0].id : null;

            // insert user activity data
            await this._pg.insert(user_activities, "user_activities");

            // ///////////////////////////////
            // Update User Models
            // ///////////////////////////////
            if (uuid.includes("unknown")) {
                const activity = {
                    uuid,
                    urls: [url]
                };
                await updateUserModel(activity);
            }
            // send the message to the next message
            return await this._onEmit(message, stream_id);
        } catch (error) {
            // error handler
            return;
        }
    }
}

// create a new instance of the bolt
const create = () => new StoreUserActivities();

export { create };