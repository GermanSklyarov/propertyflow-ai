import { loadAppConfig } from "@propertyflow/config";

const config = loadAppConfig();

console.log(`PropertyFlow API will listen on port ${config.apiPort}`);

