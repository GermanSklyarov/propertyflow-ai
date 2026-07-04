import { PropertyflowWorker } from "./jobs/propertyflow-worker.js";

const worker = new PropertyflowWorker();

await worker.waitUntilReady();
console.log("PropertyFlow worker is listening for background jobs");

const shutdown = async () => {
  console.log("PropertyFlow worker shutting down");
  await worker.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
