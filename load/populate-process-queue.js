// eslint-disable-next-line linebreak-style
const { default: PostgreSQL } = require("../dist/library/postgresQL");
// configurations
const { default: config } = require("../dist/config/config");


// establish connection
const pg = new PostgreSQL(config.pg);


async function PopulateProcessQueue() {
    let processed = 0;
    let included = 0;
    await pg.executeLarge(
        "SELECT url, material_id FROM urls WHERE material_id IS NOT NULL;",
        [],
        10,
        async (error, records, callback) => {
            for (const record of records) {
                const { url, material_id } = record;
                const existingURL = await pg.select({ material_url: url }, "material_process_queue");
                const existingOER = await pg.select({ id: material_id }, "oer_materials");
                if (existingURL.length === 0 && existingOER.lenght > 0) {
                    await pg.insert({ material_url: url, material_id, status: "material processed" }, "material_process_queue");
                    included++;
                }
                processed++;
            }
            return await callback();
        },
        (error) => {
            console.log("Processed:", processed);
            console.log("Included:", included);
         }
    );
}

// run the script
PopulateProcessQueue().catch(console.log);