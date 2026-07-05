import type { Pool } from "pg";
import type {
  PropertyAiDescriptionJobPayload,
  PropertyImageAnalysisJobPayload
} from "@propertyflow/contracts";

export class PropertyAiOutputWriter {
  constructor(private readonly pool: Pool) {}

  async saveGeneratedDescriptions(input: PropertyAiDescriptionJobPayload): Promise<number> {
    const now = new Date().toISOString();

    for (const locale of input.locales) {
      await this.pool.query(
        `
          insert into property_generated_descriptions (
            id,
            tenant_id,
            property_id,
            locale,
            title,
            description,
            source,
            review_status,
            created_at
          ) values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            'ai-worker-v1',
            'draft',
            $7
          )
        `,
        [
          crypto.randomUUID(),
          input.tenantId,
          input.propertyId,
          locale,
          this.buildTitle(locale),
          this.buildDescription(locale),
          now
        ]
      );
    }

    return input.locales.length;
  }

  async saveImageAnalysis(input: PropertyImageAnalysisJobPayload): Promise<number> {
    const now = new Date().toISOString();

    for (const [index, imageUrl] of input.imageUrls.entries()) {
      const imageId = input.imageIds?.[index] ?? null;

      await this.pool.query(
        `
          insert into property_image_analysis (
            id,
            tenant_id,
            property_id,
            property_image_id,
            image_url,
            detected_features,
            confidence,
            review_status,
            created_at
          ) values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            'draft',
            $8
          )
        `,
        [
          crypto.randomUUID(),
          input.tenantId,
          input.propertyId,
          imageId,
          imageUrl,
          this.detectFeatures(imageUrl),
          0.82,
          now
        ]
      );
    }

    return input.imageUrls.length;
  }

  private buildTitle(locale: PropertyAiDescriptionJobPayload["locales"][number]): string {
    const titles = {
      en: "AI-ready Thailand property listing",
      ru: "AI-описание объекта недвижимости в Таиланде",
      th: "รายการอสังหาริมทรัพย์ไทยที่สร้างด้วย AI",
      zh: "AI 生成的泰国房源描述"
    };

    return titles[locale];
  }

  private buildDescription(locale: PropertyAiDescriptionJobPayload["locales"][number]): string {
    const descriptions = {
      en: "Generated draft focused on lifestyle, location, rental demand, and buyer questions for agent review.",
      ru: "Черновик описания для агента: локация, стиль жизни, арендный спрос и ключевые вопросы покупателя.",
      th: "ร่างคำอธิบายสำหรับตัวแทน ครอบคลุมทำเล ไลฟ์สไตล์ ความต้องการเช่า และคำถามของผู้ซื้อ",
      zh: "面向经纪人审核的草稿，突出位置、生活方式、租赁需求和买家常见问题。"
    };

    return descriptions[locale];
  }

  private detectFeatures(imageUrl: string): string[] {
    const normalized = imageUrl.toLowerCase();
    const features = new Set<string>(["furnished", "air-conditioning"]);

    if (normalized.includes("pool")) {
      features.add("pool");
    }

    if (normalized.includes("sea") || normalized.includes("view")) {
      features.add("sea-view");
    }

    if (normalized.includes("gym")) {
      features.add("gym");
    }

    return [...features];
  }
}
