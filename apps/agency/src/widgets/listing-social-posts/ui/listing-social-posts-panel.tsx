import type {
  PropertySocialPostChannel,
  PropertySocialPostDraft,
  PropertySocialPostLocale,
  PropertySocialPostPublicationListResponse,
  PropertySocialPostReviewListResponse
} from "@propertyflow/contracts";
import {
  findDraftPublication,
  findDraftReview,
  formatSocialPostChannel,
  formatSocialPostPublishedAt,
  shortenSocialPostTrackingSlug
} from "../model/listing-social-posts-panel";
import { SocialPostDraftCard } from "./social-post-draft-card";
import styles from "./listing-social-posts-panel.module.css";

const channelOptions = [
  { label: "LINE VOOM", value: "line-voom" },
  { label: "Facebook", value: "facebook" },
  { label: "Instagram", value: "instagram" }
] satisfies Array<{ label: string; value: PropertySocialPostChannel }>;

const localeOptions = [
  { label: "English", value: "en" },
  { label: "Русский", value: "ru" },
  { label: "ไทย", value: "th" },
  { label: "中文", value: "zh" }
] satisfies Array<{ label: string; value: PropertySocialPostLocale }>;

export function ListingSocialPostsPanel({
  drafts,
  propertyId,
  publications,
  reviews,
  selectedChannels,
  selectedLocale
}: {
  drafts: PropertySocialPostDraft[];
  propertyId: string;
  publications: PropertySocialPostPublicationListResponse;
  reviews: PropertySocialPostReviewListResponse;
  selectedChannels: PropertySocialPostChannel[];
  selectedLocale: PropertySocialPostLocale;
}) {
  return (
    <section className={styles.panel} aria-label="Social post drafts">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Growth automation</p>
          <h2 className={styles.title}>Social post drafts</h2>
        </div>
        <span className={styles.counter}>
          {drafts.length} channels · {selectedLocale.toUpperCase()}
        </span>
      </div>
      <form className={styles.controls}>
        <label className={styles.localeControl}>
          <span>Language</span>
          <select name="socialLocale" defaultValue={selectedLocale}>
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.channelControls} aria-label="Social channels">
          {channelOptions.map((option) => (
            <label key={option.value}>
              <input
                defaultChecked={selectedChannels.includes(option.value)}
                name="socialChannel"
                type="checkbox"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <button className={styles.applyButton} type="submit">
          Generate variants
        </button>
      </form>
      <div className={styles.publicationHistory}>
        <div>
          <strong>{publications.total} published posts</strong>
          <span>Tracked for lead attribution</span>
        </div>
        {publications.items.length ? (
          <ul>
            {publications.items.slice(0, 4).map((item) => (
              <li key={item.id}>
                <span>{formatSocialPostChannel(item.channel)}</span>
                {item.publishedUrl ? (
                  <a href={item.publishedUrl} rel="noreferrer" target="_blank" title={item.publishedUrl}>
                    Open post
                  </a>
                ) : (
                  <em>No URL saved</em>
                )}
                <strong title={item.trackingSlug}>{shortenSocialPostTrackingSlug(item.trackingSlug)}</strong>
                <time dateTime={item.publishedAt}>{formatSocialPostPublishedAt(item.publishedAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p>No social posts have been marked as published yet.</p>
        )}
      </div>
      <div className={styles.grid}>
        {drafts.map((draft) => (
          <SocialPostDraftCard
            draft={draft}
            key={`${draft.channel}-${draft.locale}`}
            propertyId={propertyId}
            publication={findDraftPublication(draft, publications.items)}
            review={findDraftReview(draft, reviews.items)}
          />
        ))}
      </div>
    </section>
  );
}
