"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("module-alias/register");
// external modules
const qtopology = require("qtopology");
// parse the command line
const params = qtopology.parseCommandLineEx(process.argv, {
    tn: "topologyName",
    tp: "topologyPath",
});
// load the associated topology
const config = require(params.topologyPath);
qtopology.validate({ config, exitOnError: true });
// create the pipeline topology
let topology = new qtopology.TopologyLocal();
topology.init(params.topologyName, config, (error) => {
    if (error) {
        console.log(error);
        return;
    }
    // the topology has initialized
    topology.run((xerror) => {
        if (xerror) {
            console.log(xerror);
            return shutdown();
        }
    });
});
// shutdown the running topology
function shutdown() {
    if (topology) {
        topology.shutdown((error) => {
            if (error) {
                console.log("Error", error);
            }
            process.exit(1);
        });
        topology = null;
    }
}
// do something when app is closing
process.on("exit", shutdown);
// catches ctrl+c event
process.on("SIGINT", shutdown);
// catches uncaught exceptions
process.on("uncaughtException", shutdown);
