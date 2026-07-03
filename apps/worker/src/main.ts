import { loadAppConfig } from "@propertyflow/config";

const config = loadAppConfig();

console.log(`PropertyFlow worker connected to Redis at ${config.redisUrl}`);

