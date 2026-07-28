import { AlertTriangle, Bot, CheckCircle2, ListChecks } from "lucide-react";
import { knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import type { AiChatRequest, AiChatResponse, KnowledgeChunkSearchRequest } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import { getAiChatInsightKey, getAiChatInsightTone } from "../model/ai-chat-insights";
import styles from "./knowledge-ai-answer-panel.module.css";

export function KnowledgeAiAnswerPanel({
  chat,
  chatRequest,
  retrievalRequest
}: {
  chat?: AiChatResponse;
  chatRequest?: AiChatRequest;
  retrievalRequest: KnowledgeChunkSearchRequest;
}) {
  const insights = chat?.insights ?? [];

  return (
    <>
      <form action="/knowledge#knowledge-chat" className={styles.form} method="get">
        <label className={styles.query}>
          Question
          <input
            defaultValue={chatRequest?.message ?? "Which Pattaya area is best for a quiet family relocation?"}
            name="ask"
            placeholder="Which area is best for family relocation?"
          />
        </label>
        <label>
          Locale
          <select defaultValue={chatRequest?.locale ?? retrievalRequest.locale ?? "en"} name="locale">
            {knowledgeLocaleOptions.map((locale) => (
              <option key={locale} value={locale}>
                {locale.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">
          <Bot size={16} />
          Ask AI
        </button>
      </form>

      {chat ? (
        <article className={styles.answer}>
          <div className={styles.answerHeader}>
            <span>{chat.citations.length} citations</span>
            <span>{insights.length} insights</span>
            <span>{chat.suggestedActions.length} actions</span>
          </div>
          <h3>{chat.message}</h3>
          <p>{chat.answer}</p>
          {insights.length ? (
            <div className={styles.insightGrid} aria-label="Structured AI insights">
              {insights.map((insight, index) => {
                const tone = getAiChatInsightTone(insight);
                const Icon = tone === "warning" || tone === "critical" ? AlertTriangle : CheckCircle2;

                return (
                  <section className={styles.insightCard} data-tone={tone} key={getAiChatInsightKey(insight, index)}>
                    <div className={styles.insightIcon}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <span>{formatBucket(insight.kind)}</span>
                      <strong>{insight.title}</strong>
                      <p>{insight.detail}</p>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}
          <div className={styles.citationList}>
            {chat.citations.map((citation) => (
              <span key={`${citation.source}-${citation.documentId ?? citation.propertyId ?? citation.label}`}>
                {formatBucket(citation.source)} · {citation.label}
              </span>
            ))}
          </div>
          <div className={styles.actionRow}>
            {chat.suggestedActions.map((action) => (
              <span key={action}>{formatBucket(action)}</span>
            ))}
          </div>
        </article>
      ) : (
        <div className={styles.placeholder}>
          <ListChecks size={22} />
          <strong>Ask a question to verify the final AI answer</strong>
          <p>The answer will include citations, matched properties, structured insights, and suggested next actions.</p>
        </div>
      )}
    </>
  );
}
