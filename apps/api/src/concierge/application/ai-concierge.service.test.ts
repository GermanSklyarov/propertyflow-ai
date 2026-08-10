import { describe, expect, it } from "vitest";
import { AiConciergeService } from "./ai-concierge.service.js";

describe("AiConciergeService", () => {
  it("infers Thai concierge profile signals and keeps follow-up copy localized", async () => {
    const service = serviceFactory();

    const response = await service.advise("demo-agency", {
      locale: "th",
      message: "คอนโดให้เช่าภูเก็ต งบไม่เกิน 40000 บาทต่อเดือน ทำงานออนไลน์ ไม่มีรถ ชอบโซนเงียบ อยู่เอง"
    });

    expect(response.profile).toMatchObject({
      market: "phuket",
      listingIntent: "rent",
      budgetThb: 40_000,
      purpose: "living",
      remoteWork: true,
      hasCar: false,
      prefersQuiet: true
    });
    expect(response.summary).toContain("ฉันเข้าใจข้อมูลเบื้องต้นแล้ว");
    expect(response.nextQuestions.map((question) => question.question).join(" ")).toContain("จะมีเด็กพักอาศัยด้วยไหม");
  });

  it("infers Chinese concierge profile signals without treating rent-out yield as rental intent", async () => {
    const service = serviceFactory();

    const response = await service.advise("demo-agency", {
      locale: "zh",
      message: "想在芭提雅购买公寓，预算不超过300万泰铢，适合投资出租收益，需要安静，有车，远程办公"
    });

    expect(response.profile).toMatchObject({
      market: "pattaya",
      listingIntent: "sale",
      budgetThb: 3_000_000,
      purpose: "investment",
      remoteWork: true,
      hasCar: true,
      prefersQuiet: true
    });
    expect(response.summary).toContain("我已了解这些条件");
    expect(response.nextQuestions.map((question) => question.question).join(" ")).toContain("会有孩子一起居住吗");
  });
});

function serviceFactory(): AiConciergeService {
  return new AiConciergeService(
    { query: async () => ({ rows: [] }) } as never,
    {} as never,
    { search: async () => [] } as never
  );
}
