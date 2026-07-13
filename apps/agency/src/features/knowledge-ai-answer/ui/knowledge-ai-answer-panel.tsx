import { Bot } from "lucide-react";
import { knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import type { AiChatRequest, AiChatResponse, KnowledgeChunkSearchRequest } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
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
  return (
    <>
      <form className={styles.form}>
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
            <span>{chat.suggestedActions.length} actions</span>
          </div>
          <h3>{chat.message}</h3>
          <p>{chat.answer}</p>
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
          <Bot size={22} />
          <strong>Ask a question to verify the final AI answer</strong>
          <p>The answer will include citations, matched properties when relevant, and suggested next actions.</p>
        </div>
      )}
    </>
  );
}
