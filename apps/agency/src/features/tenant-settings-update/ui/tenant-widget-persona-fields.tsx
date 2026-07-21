"use client";

import { useMemo, useState } from "react";
import type { TenantWidgetLanguage, TenantWidgetPersonaGender, TenantWidgetSettings } from "@propertyflow/contracts";
import { supportedTenantWidgetLanguageOptions } from "@entities/tenant/model/widget-settings";
import styles from "./update-tenant-settings-form.module.css";

const personaGenderOptions: Array<{ label: string; value: TenantWidgetPersonaGender }> = [
  { label: "Feminine voice", value: "feminine" },
  { label: "Masculine voice", value: "masculine" },
  { label: "Neutral voice", value: "neutral" }
];

export function TenantWidgetPersonaFields({ widgetSettings }: { widgetSettings: TenantWidgetSettings }) {
  const initialLanguages: TenantWidgetLanguage[] = widgetSettings.languages.length ? widgetSettings.languages : ["en"];
  const [languages, setLanguages] = useState<TenantWidgetLanguage[]>(initialLanguages);
  const [activeLanguage, setActiveLanguage] = useState<TenantWidgetLanguage>(initialLanguages[0] ?? "en");
  const [aiNames, setAiNames] = useState<Record<TenantWidgetLanguage, string>>(() => getCompleteNames(widgetSettings));
  const [welcomeMessages, setWelcomeMessages] = useState<Record<TenantWidgetLanguage, string>>(() =>
    getCompleteWelcomeMessages(widgetSettings)
  );
  const [personaGenders, setPersonaGenders] = useState<Record<TenantWidgetLanguage, TenantWidgetPersonaGender>>(() =>
    getCompletePersonaGenders(widgetSettings)
  );

  const visibleLanguages = useMemo(
    () => supportedTenantWidgetLanguageOptions.filter((language) => languages.includes(language.value)),
    [languages]
  );
  const activeOption =
    supportedTenantWidgetLanguageOptions.find((language) => language.value === activeLanguage) ?? visibleLanguages[0];

  function toggleLanguage(language: TenantWidgetLanguage) {
    setLanguages((current) => {
      const next = current.includes(language)
        ? current.filter((selectedLanguage) => selectedLanguage !== language)
        : [...current, language];
      const safeNext = next.length ? next : current;

      if (!safeNext.includes(activeLanguage)) {
        setActiveLanguage(safeNext[0] ?? "en");
      }

      return safeNext;
    });
  }

  function updateName(language: TenantWidgetLanguage, value: string) {
    const previousName = aiNames[language];

    setAiNames((current) => ({ ...current, [language]: value }));
    setWelcomeMessages((current) => {
      const generatedBefore = buildWelcomeMessage(language, previousName, personaGenders[language]);

      if (current[language] && current[language] !== generatedBefore) {
        return current;
      }

      return {
        ...current,
        [language]: buildWelcomeMessage(language, value, personaGenders[language])
      };
    });
  }

  function updatePersonaGender(language: TenantWidgetLanguage, value: TenantWidgetPersonaGender) {
    setPersonaGenders((current) => ({ ...current, [language]: value }));
    setWelcomeMessages((current) => {
      const generatedBefore = buildWelcomeMessage(language, aiNames[language], personaGenders[language]);

      if (current[language] && current[language] !== generatedBefore) {
        return current;
      }

      return {
        ...current,
        [language]: buildWelcomeMessage(language, aiNames[language], value)
      };
    });
  }

  return (
    <div className={styles.personaBuilder}>
      <div className={styles.field}>
        <span>Languages</span>
        <div className={styles.languageOptions}>
          {supportedTenantWidgetLanguageOptions.map((language) => (
            <label className={styles.languageOption} key={language.value}>
              <input
                checked={languages.includes(language.value)}
                name="languages"
                onChange={() => toggleLanguage(language.value)}
                type="checkbox"
                value={language.value}
              />
              <span>{language.label}</span>
              <strong>{language.value.toUpperCase()}</strong>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.personaTabs} role="tablist">
        {visibleLanguages.map((language) => (
          <button
            aria-selected={activeLanguage === language.value}
            className={activeLanguage === language.value ? styles.personaTabActive : styles.personaTab}
            key={language.value}
            onClick={() => setActiveLanguage(language.value)}
            role="tab"
            type="button"
          >
            {language.label}
            <strong>{language.value.toUpperCase()}</strong>
          </button>
        ))}
      </div>

      {activeOption ? (
        <div className={styles.personaEditor}>
          <label className={styles.field}>
            <span>{activeOption.label} concierge name</span>
            <input
              name={`aiName.${activeOption.value}`}
              onChange={(event) => updateName(activeOption.value, event.target.value)}
              required
              value={aiNames[activeOption.value]}
            />
          </label>
          <label className={styles.field}>
            <span>{activeOption.label} grammar voice</span>
            <select
              name={`personaGender.${activeOption.value}`}
              onChange={(event) =>
                updatePersonaGender(activeOption.value, event.target.value as TenantWidgetPersonaGender)
              }
              value={personaGenders[activeOption.value]}
            >
              {personaGenderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.field} ${styles.personaMessageField}`}>
            <span>{activeOption.label} welcome message</span>
            <textarea
              name={`welcomeMessage.${activeOption.value}`}
              onChange={(event) =>
                setWelcomeMessages((current) => ({ ...current, [activeOption.value]: event.target.value }))
              }
              required
              rows={3}
              value={welcomeMessages[activeOption.value]}
            />
          </label>
        </div>
      ) : null}

      {supportedTenantWidgetLanguageOptions
        .filter((language) => !languages.includes(language.value))
        .map((language) => (
          <div hidden key={language.value}>
            <input name={`aiName.${language.value}`} readOnly value={aiNames[language.value]} />
            <input name={`personaGender.${language.value}`} readOnly value={personaGenders[language.value]} />
            <textarea name={`welcomeMessage.${language.value}`} readOnly value={welcomeMessages[language.value]} />
          </div>
        ))}

      <p className={styles.hint}>
        The widget can use the site locale, then select the matching name, grammar voice, and welcome message. Keep
        neutral voice for languages where gendered assistant wording is not needed.
      </p>
    </div>
  );
}

function getCompleteNames(widgetSettings: TenantWidgetSettings): Record<TenantWidgetLanguage, string> {
  return {
    en: widgetSettings.aiNames.en ?? widgetSettings.aiName,
    ru: widgetSettings.aiNames.ru ?? "Анна",
    th: widgetSettings.aiNames.th ?? "มาลี",
    zh: widgetSettings.aiNames.zh ?? "安娜"
  };
}

function getCompletePersonaGenders(widgetSettings: TenantWidgetSettings): Record<TenantWidgetLanguage, TenantWidgetPersonaGender> {
  return {
    en: widgetSettings.personaGenders.en ?? "feminine",
    ru: widgetSettings.personaGenders.ru ?? "feminine",
    th: widgetSettings.personaGenders.th ?? "feminine",
    zh: widgetSettings.personaGenders.zh ?? "neutral"
  };
}

function getCompleteWelcomeMessages(widgetSettings: TenantWidgetSettings): Record<TenantWidgetLanguage, string> {
  const names = getCompleteNames(widgetSettings);
  const personaGenders = getCompletePersonaGenders(widgetSettings);

  return {
    en: widgetSettings.welcomeMessages.en ?? buildWelcomeMessage("en", names.en, personaGenders.en),
    ru: widgetSettings.welcomeMessages.ru ?? buildWelcomeMessage("ru", names.ru, personaGenders.ru),
    th: widgetSettings.welcomeMessages.th ?? buildWelcomeMessage("th", names.th, personaGenders.th),
    zh: widgetSettings.welcomeMessages.zh ?? buildWelcomeMessage("zh", names.zh, personaGenders.zh)
  };
}

function buildWelcomeMessage(
  language: TenantWidgetLanguage,
  name: string,
  personaGender: TenantWidgetPersonaGender
) {
  if (language === "ru") {
    return personaGender === "feminine"
      ? `Привет! Я ${name}, ваша AI-консультантка по недвижимости.`
      : `Привет! Я ${name}, ваш AI-консультант по недвижимости.`;
  }

  if (language === "th") {
    const particle = personaGender === "masculine" ? "ครับ" : personaGender === "feminine" ? "ค่ะ" : "";

    return `สวัสดี${particle} ฉันชื่อ ${name} ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ`;
  }

  if (language === "zh") {
    return `你好！我是 ${name}，你的 AI 房产顾问。`;
  }

  return `Hi! I'm ${name}, your AI property consultant.`;
}
