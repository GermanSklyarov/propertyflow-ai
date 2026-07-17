import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  GeneratePropertySocialPostsRequest,
  GeneratePropertySocialPostsResponse,
  PropertyImageSnapshot,
  PropertySocialPostApprovalWorkflow,
  PropertySocialPostChannel,
  PropertySocialPostDraft,
  PropertySocialPostMediaPlan,
  PropertySocialPostPublicationPlan,
  PropertySocialPostReadinessCheck,
  PropertySocialPostLocale,
  RecordPropertySocialPostPublicationRequest,
  RecordPropertySocialPostPublicationResponse,
  RequestUser
} from "@propertyflow/contracts";
import type { Money, PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_IMAGES_REPOSITORY, type PropertyImagesRepository } from "../../domain/property-images.repository.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import {
  PROPERTY_SOCIAL_POST_PUBLICATIONS_REPOSITORY,
  type PropertySocialPostPublicationsRepository
} from "../../domain/property-social-post-publications.repository.js";

const allChannels: PropertySocialPostChannel[] = ["line-voom", "facebook", "instagram"];
const copyByLocale = {
  en: {
    addAmenities: "Add amenities before publishing to strengthen the post.",
    facebookCta: "Use this draft for a Facebook post with gallery photos and a lead form link.",
    instagramCta: "Pair with the cover photo and first three gallery images for carousel publishing.",
    lineVoomCta: "Message the agency for availability, viewing slots, and updated ownership costs.",
    highlights: "Highlights",
    lineVoomHook: (title: string) => `${title} is ready for a LINE VOOM property spotlight.`,
    instagramHook: (title: string, market: string) => `${title} in ${market}`,
    instagramBody: (market: string, priceLine: string, amenityLine: string) =>
      `${market} property pick. ${priceLine}. ${amenityLine}`,
    facebookBody: (title: string, listingType: string, market: string, description: string, amenityLine: string) =>
      `${title} gives clients a clear ${listingType.toLowerCase()} option in ${market}. ${description} ${amenityLine}`,
    fallback: (listing: PropertySnapshot) =>
      `${listing.areaSqm} sqm ${formatBucket(listing.kind)} with ${listing.bedrooms} bedroom${listing.bedrooms === 1 ? "" : "s"}.`
  },
  ru: {
    addAmenities: "Добавьте удобства перед публикацией, чтобы пост выглядел сильнее.",
    facebookCta: "Используйте этот черновик для Facebook вместе с галереей и ссылкой на лид-форму.",
    instagramCta: "Опубликуйте как карусель с обложкой и первыми фото из галереи.",
    lineVoomCta: "Напишите агентству, чтобы уточнить доступность, просмотры и расходы владения.",
    highlights: "Преимущества",
    lineVoomHook: (title: string) => `${title}: готовый черновик для LINE VOOM.`,
    instagramHook: (title: string, market: string) => `${title} в локации ${market}`,
    instagramBody: (market: string, priceLine: string, amenityLine: string) =>
      `Объект в Таиланде: ${market}. ${priceLine}. ${amenityLine}`,
    facebookBody: (title: string, listingType: string, market: string, description: string, amenityLine: string) =>
      `${title} — вариант ${listingType.toLowerCase()} в локации ${market}. ${description} ${amenityLine}`,
    fallback: (listing: PropertySnapshot) =>
      `${listing.areaSqm} кв.м, ${formatBucket(listing.kind)}, ${listing.bedrooms} спальн${listing.bedrooms === 1 ? "я" : "и"}.`
  },
  th: {
    addAmenities: "เพิ่มสิ่งอำนวยความสะดวกก่อนเผยแพร่ เพื่อให้โพสต์น่าสนใจขึ้น.",
    facebookCta: "ใช้ร่างนี้สำหรับโพสต์ Facebook พร้อมรูปแกลเลอรีและลิงก์ฟอร์มลูกค้า.",
    instagramCta: "ใช้คู่กับรูปปกและรูปแรก ๆ ในแกลเลอรีสำหรับโพสต์แบบ carousel.",
    lineVoomCta: "ติดต่อเอเจนซี่เพื่อเช็กสถานะ นัดชม และค่าใช้จ่ายล่าสุด.",
    highlights: "จุดเด่น",
    lineVoomHook: (title: string) => `${title} พร้อมเป็นโพสต์ LINE VOOM.`,
    instagramHook: (title: string, market: string) => `${title} ใน ${market}`,
    instagramBody: (market: string, priceLine: string, amenityLine: string) =>
      `อสังหาริมทรัพย์ใน ${market}. ${priceLine}. ${amenityLine}`,
    facebookBody: (title: string, listingType: string, market: string, description: string, amenityLine: string) =>
      `${title} เป็นตัวเลือก${listingType.toLowerCase()}ใน ${market}. ${description} ${amenityLine}`,
    fallback: (listing: PropertySnapshot) =>
      `${listing.areaSqm} ตร.ม. ${formatBucket(listing.kind)} ${listing.bedrooms} ห้องนอน.`
  },
  zh: {
    addAmenities: "发布前请补充设施亮点，让帖子更有说服力。",
    facebookCta: "可将此草稿用于 Facebook，并搭配图库照片和线索表单链接。",
    instagramCta: "建议搭配封面图和前三张图库照片做轮播发布。",
    lineVoomCta: "联系代理确认房源状态、看房时间和最新持有成本。",
    highlights: "亮点",
    lineVoomHook: (title: string) => `${title} 已准备好用于 LINE VOOM 推广。`,
    instagramHook: (title: string, market: string) => `${title}，位于 ${market}`,
    instagramBody: (market: string, priceLine: string, amenityLine: string) =>
      `${market} 泰国房源推荐。${priceLine}。${amenityLine}`,
    facebookBody: (title: string, listingType: string, market: string, description: string, amenityLine: string) =>
      `${title} 是 ${market} 的${listingType.toLowerCase()}选择。${description} ${amenityLine}`,
    fallback: (listing: PropertySnapshot) =>
      `${listing.areaSqm} 平米 ${formatBucket(listing.kind)}，${listing.bedrooms} 间卧室。`
  }
} satisfies Record<PropertySocialPostLocale, {
  addAmenities: string;
  facebookCta: string;
  instagramCta: string;
  lineVoomCta: string;
  highlights: string;
  lineVoomHook: (title: string) => string;
  instagramHook: (title: string, market: string) => string;
  instagramBody: (market: string, priceLine: string, amenityLine: string) => string;
  facebookBody: (title: string, listingType: string, market: string, description: string, amenityLine: string) => string;
  fallback: (listing: PropertySnapshot) => string;
}>;

@Injectable()
export class PropertySocialPostsService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PROPERTY_IMAGES_REPOSITORY) private readonly images: PropertyImagesRepository,
    @Inject(PROPERTY_SOCIAL_POST_PUBLICATIONS_REPOSITORY)
    private readonly publications: PropertySocialPostPublicationsRepository
  ) {}

  async generateDrafts(
    tenantId: string,
    propertyId: string,
    request: GeneratePropertySocialPostsRequest = {}
  ): Promise<GeneratePropertySocialPostsResponse> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const locale = request.locale ?? "en";
    const channels = request.channels?.length ? request.channels : allChannels;
    const gallery = await this.images.listByPropertyId(tenantId, propertyId);
    const publicPhotoCount = request.publicPhotoCount ?? gallery.length;

    return {
      propertyId,
      locale,
      drafts: channels.map((channel) => buildDraft(property, gallery, channel, locale, publicPhotoCount))
    };
  }

  async recordPublication(
    tenantId: string,
    propertyId: string,
    request: RecordPropertySocialPostPublicationRequest,
    user: RequestUser
  ): Promise<RecordPropertySocialPostPublicationResponse> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return {
      publication: await this.publications.record(tenantId, propertyId, request, user)
    };
  }
}

function buildDraft(
  listing: PropertySnapshot,
  gallery: PropertyImageSnapshot[],
  channel: PropertySocialPostChannel,
  locale: PropertySocialPostLocale,
  publicPhotoCount: number
): PropertySocialPostDraft {
  const priceLine = buildPriceLine(listing);
  const market = formatBucket(listing.market);
  const projectLine = listing.project ? `${listing.project.name}, ${market}` : market;
  const copy = copyByLocale[locale];
  const amenityLine = buildAmenityLine(listing, locale);
  const status: PropertySocialPostDraft["status"] = listing.description && publicPhotoCount > 0 ? "ready" : "review";
  const hashtags = buildHashtags(listing);
  const description = buildShortDescription(listing, locale);
  const mediaPlan = buildMediaPlan(channel, gallery, publicPhotoCount);
  const publicationPlan = buildPublicationPlan(listing, channel, locale);
  const readiness = buildReadiness(listing, hashtags, mediaPlan);
  const approvalWorkflow = buildApprovalWorkflow(readiness);

  if (channel === "line-voom") {
    return {
      approvalWorkflow,
      body: `${projectLine}. ${priceLine}. ${amenityLine} ${description}`,
      channel,
      cta: copy.lineVoomCta,
      hashtags,
      hook: copy.lineVoomHook(listing.title),
      label: "LINE VOOM",
      locale,
      mediaPlan,
      publicationPlan,
      readiness,
      status
    };
  }

  if (channel === "facebook") {
    return {
      approvalWorkflow,
      body: copy.facebookBody(listing.title, formatListingType(listing.listingType, locale), market, description, amenityLine),
      channel,
      cta: copy.facebookCta,
      hashtags,
      hook: `${listing.title}: ${priceLine}`,
      label: "Facebook",
      locale,
      mediaPlan,
      publicationPlan,
      readiness,
      status
    };
  }

  return {
    approvalWorkflow,
    body: copy.instagramBody(market, priceLine, amenityLine),
    channel,
    cta: copy.instagramCta,
    hashtags,
    hook: copy.instagramHook(listing.title, market),
    label: "Instagram",
    locale,
    mediaPlan,
    publicationPlan,
    readiness,
    status
  };
}

function buildApprovalWorkflow(readiness: PropertySocialPostReadinessCheck[]): PropertySocialPostApprovalWorkflow {
  const blockers = readiness.filter((check) => !check.ready);

  if (blockers.length) {
    return {
      allowedActions: [],
      currentStage: "review",
      reviewNote: `Resolve ${blockers.map((check) => check.key).join(", ")} before approval.`,
      stages: [
        { key: "draft", label: "Draft", state: "complete" },
        { key: "review", label: "Review", state: "current" },
        { key: "approved", label: "Approved", state: "blocked" },
        { key: "published", label: "Published", state: "blocked" }
      ]
    };
  }

  return {
    allowedActions: ["request-review", "approve"],
    currentStage: "draft",
    reviewNote: "Ready for agent review and manager approval.",
    stages: [
      { key: "draft", label: "Draft", state: "current" },
      { key: "review", label: "Review", state: "pending" },
      { key: "approved", label: "Approved", state: "pending" },
      { key: "published", label: "Published", state: "pending" }
    ]
  };
}

function buildPublicationPlan(
  listing: PropertySnapshot,
  channel: PropertySocialPostChannel,
  locale: PropertySocialPostLocale
): PropertySocialPostPublicationPlan {
  const campaign = `${slugify(listing.market)}-${slugify(listing.listingType)}-${slugify(listing.id)}`;
  const content = `${slugify(channel)}-${locale}`;

  return {
    nextAction: buildNextAction(channel),
    trackingSlug: `${campaign}-${content}`,
    utm: {
      campaign,
      content,
      medium: "social",
      source: channel
    }
  };
}

function buildNextAction(channel: PropertySocialPostChannel) {
  if (channel === "line-voom") {
    return "Publish to LINE VOOM and use the tracking slug for reply attribution.";
  }

  if (channel === "facebook") {
    return "Publish with a lead form or message CTA, then tag incoming leads with this campaign.";
  }

  return "Publish as a carousel and keep the UTM content code with the campaign notes.";
}

function buildReadiness(
  listing: PropertySnapshot,
  hashtags: string[],
  mediaPlan: PropertySocialPostMediaPlan
): PropertySocialPostReadinessCheck[] {
  return [
    {
      key: "copy",
      label: listing.description ? "Listing copy available" : "Description missing",
      ready: Boolean(listing.description)
    },
    {
      key: "media",
      label: mediaPlan.items.length ? `${mediaPlan.items.length} photos selected` : "Gallery photos missing",
      ready: mediaPlan.items.length > 0
    },
    {
      key: "hashtags",
      label: hashtags.length >= 3 ? `${hashtags.length} hashtags ready` : "Hashtags need review",
      ready: hashtags.length >= 3
    }
  ];
}

function buildMediaPlan(
  channel: PropertySocialPostChannel,
  gallery: PropertyImageSnapshot[],
  publicPhotoCount: number
): PropertySocialPostMediaPlan {
  const limit = channel === "instagram" ? 5 : channel === "facebook" ? 8 : 4;
  const selected = gallery.slice(0, limit);
  const warnings = [];

  if (!publicPhotoCount || !selected.length) {
    warnings.push("Add public gallery photos before publishing this post.");
  }

  if (channel === "instagram" && selected.length < 3) {
    warnings.push("Instagram carousel works best with at least 3 photos.");
  }

  return {
    items: selected.map((image, index) => ({
      caption: image.caption,
      imageId: image.id,
      imageUrl: image.imageUrl,
      role: index === 0 ? "cover" : "carousel"
    })),
    summary: selected.length
      ? `${selected.length} recommended photo${selected.length === 1 ? "" : "s"} from the public gallery`
      : "No public gallery photos selected",
    warnings
  };
}

function buildPriceLine(listing: PropertySnapshot) {
  if (listing.listingType === "rent" && listing.rentalPriceMonthly) {
    return `${formatMoney(listing.rentalPriceMonthly)}/month`;
  }

  if (listing.listingType === "sale_or_rent" && listing.rentalPriceMonthly) {
    return `${formatMoney(listing.price)} or ${formatMoney(listing.rentalPriceMonthly)}/month`;
  }

  return formatMoney(listing.price);
}

function buildAmenityLine(listing: PropertySnapshot, locale: PropertySocialPostLocale) {
  const amenities = [...listing.amenities, ...(listing.project?.amenities ?? [])]
    .map(formatBucket)
    .filter(Boolean)
    .slice(0, 4);
  const copy = copyByLocale[locale];

  if (!amenities.length) {
    return copy.addAmenities;
  }

  return `${copy.highlights}: ${amenities.join(", ")}.`;
}

function buildShortDescription(listing: PropertySnapshot, locale: PropertySocialPostLocale) {
  const fallback = copyByLocale[locale].fallback(listing);
  const source = listing.description?.trim() || fallback;

  return source.length > 180 ? `${source.slice(0, 177).trim()}...` : source;
}

function buildHashtags(listing: PropertySnapshot) {
  const rawTags = [
    `${formatBucket(listing.market)} property`,
    "Thailand real estate",
    `${formatBucket(listing.kind)} ${listing.listingType === "rent" ? "rent" : "sale"}`,
    listing.project?.name
  ];

  return rawTags
    .filter((value): value is string => Boolean(value))
    .map(toHashtag)
    .filter((value, index, values) => value.length > 1 && values.indexOf(value) === index)
    .slice(0, 5);
}

function formatListingType(value: PropertySnapshot["listingType"], locale: PropertySocialPostLocale) {
  const labels = {
    en: {
      rent: "For rent",
      sale: "For sale",
      sale_or_rent: "Sale or rent"
    },
    ru: {
      rent: "для аренды",
      sale: "для продажи",
      sale_or_rent: "для продажи или аренды"
    },
    th: {
      rent: "ให้เช่า",
      sale: "ขาย",
      sale_or_rent: "ขายหรือให้เช่า"
    },
    zh: {
      rent: "出租",
      sale: "出售",
      sale_or_rent: "出售或出租"
    }
  } satisfies Record<PropertySocialPostLocale, Record<PropertySnapshot["listingType"], string>>;

  return labels[locale][value];
}

function formatMoney(value: Money) {
  return new Intl.NumberFormat("en", {
    currency: value.currency,
    maximumFractionDigits: value.amount >= 1_000_000 ? 1 : 0,
    notation: value.amount >= 1_000_000 ? "compact" : "standard",
    style: "currency"
  }).format(value.amount);
}

function formatBucket(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function toHashtag(value: string) {
  const words = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return `#${words.map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`).join("")}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}
