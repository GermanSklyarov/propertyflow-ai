import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { loadAppConfig } from "@propertyflow/config";
import { AppModule } from "./app.module.js";

const config = loadAppConfig();

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  })
);

app.enableCors();

const openApiConfig = new DocumentBuilder()
  .setTitle("PropertyFlow AI API")
  .setDescription("AI-first Thailand real estate SaaS API")
  .setVersion("0.1.0")
  .addApiKey({ type: "apiKey", name: "x-tenant-id", in: "header" }, "tenant-id")
  .addApiKey({ type: "apiKey", name: "x-user-id", in: "header" }, "user-id")
  .addApiKey({ type: "apiKey", name: "x-user-role", in: "header" }, "user-role")
  .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "public-api-key")
  .addTag("properties")
  .addTag("tenants")
  .addTag("analytics")
  .addTag("public-properties")
  .addTag("leads")
  .addTag("public-leads")
  .build();
const openApiDocument = () => SwaggerModule.createDocument(app, openApiConfig);

SwaggerModule.setup("docs", app, openApiDocument, {
  jsonDocumentUrl: "docs-json",
  customSiteTitle: "PropertyFlow AI API"
});

await app.listen(config.apiPort);

console.log(`PropertyFlow API listening on port ${config.apiPort}`);
console.log(`Swagger docs available at /docs`);
