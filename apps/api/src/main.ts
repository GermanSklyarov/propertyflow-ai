import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadAppConfig } from "@propertyflow/config";
import { AppModule } from "./app.module.js";

const config = loadAppConfig();

const app = await NestFactory.create(AppModule);

app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  })
);

app.enableCors();

await app.listen(config.apiPort);

console.log(`PropertyFlow API listening on port ${config.apiPort}`);

