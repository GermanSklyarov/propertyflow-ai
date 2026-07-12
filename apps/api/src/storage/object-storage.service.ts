import { Injectable } from "@nestjs/common";
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadAppConfig } from "@propertyflow/config";

export interface PresignedPutObjectRequest {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedPutObjectResponse {
  bucket: string;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface PresignedGetObjectRequest {
  bucket?: string;
  objectKey: string;
  expiresInSeconds?: number;
}

export interface PresignedGetObjectResponse {
  objectUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class ObjectStorageService {
  private readonly config = loadAppConfig();
  private readonly client = new S3Client({
    region: "us-east-1",
    endpoint: this.config.s3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: this.config.s3AccessKey,
      secretAccessKey: this.config.s3SecretKey
    }
  });

  async createPresignedPutUrl(request: PresignedPutObjectRequest): Promise<PresignedPutObjectResponse> {
    await this.ensureBucket();

    const expiresInSeconds = request.expiresInSeconds ?? 900;
    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: request.objectKey,
      ContentType: request.contentType
    });

    return {
      bucket: this.config.s3Bucket,
      objectKey: request.objectKey,
      uploadUrl: await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds }),
      method: "PUT",
      headers: {
        "content-type": request.contentType
      },
      expiresInSeconds
    };
  }

  async createPresignedGetUrl(request: PresignedGetObjectRequest): Promise<PresignedGetObjectResponse> {
    const expiresInSeconds = request.expiresInSeconds ?? 300;
    const command = new GetObjectCommand({
      Bucket: request.bucket ?? this.config.s3Bucket,
      Key: request.objectKey
    });

    return {
      objectUrl: await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds }),
      expiresInSeconds
    };
  }

  publicObjectUrl(bucket: string, objectKey: string): string {
    return `${this.config.s3Endpoint.replace(/\/$/, "")}/${bucket}/${objectKey}`;
  }

  defaultBucket(): string {
    return this.config.s3Bucket;
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.s3Bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.s3Bucket }));
    }
  }
}
