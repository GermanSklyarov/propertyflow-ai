(function () {
  "use strict";

  var script = document.currentScript;

  if (!script || document.querySelector("[data-propertyflow-widget-root]")) {
    return;
  }

  var tenantSlug = readAttribute(script, "tenant", "");

  if (!tenantSlug) {
    return;
  }

  var apiBase = readAttribute(script, "api-base", inferApiBase(script.src));
  var embedMode = readAttribute(script, "mode", "starter");
  var requestedLocale = resolveRequestedLocale(readAttribute(script, "locale", "auto"));
  var fallbackConfig = {
    aiName: readAttribute(script, "ai-name", "Anna"),
    aiNames: readJsonAttribute(script, "ai-names", {}),
    branding: {
      displayName: "PropertyFlowAI",
      primaryColor: "#0f766e"
    },
    capabilities: {
      knowledgeAnswers: true,
      leadCapture: embedMode === "growth" || embedMode === "enterprise",
      propertySearch: true
    },
    conciergeMode: embedMode,
    languages: readAttribute(script, "languages", "en").split(",").filter(Boolean),
    personaGenders: readJsonAttribute(script, "persona-genders", {}),
    readiness: {
      checks: [],
      nextAction: "",
      status: "test-mode"
    },
    tenantSlug: tenantSlug,
    tone: readAttribute(script, "tone", "friendly"),
    welcomeMessage: readAttribute(script, "welcome-message", "Hi! I can help you find the right property."),
    welcomeMessages: readJsonAttribute(script, "welcome-messages", {})
  };

  var state = {
    config: fallbackConfig,
    handoff: {
      contactEmail: "",
      contactName: "",
      contactPhone: "",
      error: "",
      message: ""
    },
    isHandoffOpen: false,
    isHandoffSending: false,
    isOpen: false,
    isReady: false,
    isSending: false,
    locale: requestedLocale,
    messages: []
  };

  var host = document.createElement("div");
  host.setAttribute("data-propertyflow-widget-root", "true");
  document.body.append(host);

  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  var style = document.createElement("style");
  style.textContent = buildStyles();
  var app = document.createElement("div");
  root.append(style, app);

  fetchConfig()
    .then(function (config) {
      state.config = mergeConfig(fallbackConfig, config);
      state.locale = pickLocale(requestedLocale, state.config.languages);
      state.isReady = true;
      state.messages = loadStoredMessages();
      if (!state.messages.length) {
        state.messages = [assistantMessage(getWelcomeMessage(state.config, state.locale))];
        persistMessages();
      }
      render();
    })
    .catch(function () {
      state.locale = pickLocale(requestedLocale, state.config.languages);
      state.messages = loadStoredMessages();
      if (!state.messages.length) {
        state.messages = [assistantMessage(getWelcomeMessage(state.config, state.locale))];
        persistMessages();
      }
      render("The concierge is running from embedded settings. Live knowledge answers are unavailable right now.");
    });

  render();

  function render(errorMessage) {
    var config = state.config;
    var primaryColor = sanitizeColor(config.branding.primaryColor || "#0f766e");
    var displayName = escapeText(config.branding.displayName || "PropertyFlowAI");
    var aiName = escapeText(getLocalizedValue(config.aiNames, state.locale, config.aiName || "Anna"));
    var mode = escapeText(config.conciergeMode || "starter");
    var canCreateLead = config.capabilities && config.capabilities.leadCapture === true;
    var languageLabel = escapeText(state.locale.toUpperCase());
    var handoff = state.handoff;
    var messages = state.messages
      .map(function (message) {
        return '<div class="pf-message pf-message-' + message.role + '">' + escapeText(message.text) + "</div>";
      })
      .join("");

    app.innerHTML =
      '<div class="pf-shell" style="--pf-primary:' +
      primaryColor +
      '">' +
      '<button class="pf-launcher" type="button" aria-expanded="' +
      String(state.isOpen) +
      '">' +
      '<span class="pf-launcher-mark">' +
      aiName.slice(0, 1).toUpperCase() +
      "</span>" +
      '<span><strong>' +
      aiName +
      '</strong><small>AI property concierge</small></span>' +
      "</button>" +
      (state.isOpen
        ? '<section class="pf-panel" aria-label="PropertyFlow AI Concierge">' +
          '<header><div><strong>' +
          aiName +
          '</strong><span>' +
          displayName +
          " · " +
          mode +
          " · " +
          languageLabel +
          '</span></div><div class="pf-header-actions"><button class="pf-reset" type="button">Start over</button><button class="pf-close" type="button" aria-label="Close">×</button></div></header>' +
          (errorMessage ? '<p class="pf-error">' + escapeText(errorMessage) + "</p>" : "") +
          '<div class="pf-thread">' +
          messages +
          (state.isSending ? '<div class="pf-message pf-message-assistant">Thinking...</div>' : "") +
          "</div>" +
          '<form class="pf-form">' +
          '<textarea name="message" rows="2" placeholder="' +
          escapeText(getPlaceholder(state.locale)) +
          '"' +
          (state.isReady ? "" : " disabled") +
          "></textarea>" +
          '<button type="submit"' +
          (state.isReady && !state.isSending ? "" : " disabled") +
          ">Ask</button>" +
          "</form>" +
          '<small class="pf-note">Answers use this agency knowledge base and listings. CRM is not required for Starter mode.</small>' +
          (canCreateLead
            ? '<div class="pf-handoff">' +
              '<button class="pf-handoff-toggle" type="button" aria-expanded="' +
              String(state.isHandoffOpen) +
              '">' +
              getHandoffCta(state.locale) +
              "</button>" +
              (state.isHandoffOpen
                ? '<form class="pf-handoff-form">' +
                  (handoff.error ? '<p class="pf-handoff-error">' + escapeText(handoff.error) + "</p>" : "") +
                  '<input name="contactName" placeholder="' +
                  escapeText(getHandoffNamePlaceholder(state.locale)) +
                  '" value="' +
                  escapeText(handoff.contactName) +
                  '"' +
                  (state.isReady && !state.isHandoffSending ? "" : " disabled") +
                  " />" +
                  '<div class="pf-handoff-grid">' +
                  '<input name="contactEmail" type="email" placeholder="Email" value="' +
                  escapeText(handoff.contactEmail) +
                  '"' +
                  (state.isReady && !state.isHandoffSending ? "" : " disabled") +
                  " />" +
                  '<input name="contactPhone" placeholder="' +
                  escapeText(getHandoffPhonePlaceholder(state.locale)) +
                  '" value="' +
                  escapeText(handoff.contactPhone) +
                  '"' +
                  (state.isReady && !state.isHandoffSending ? "" : " disabled") +
                  " />" +
                  "</div>" +
                  '<textarea name="handoffMessage" rows="2" placeholder="' +
                  escapeText(getHandoffMessagePlaceholder(state.locale)) +
                  '"' +
                  (state.isReady && !state.isHandoffSending ? "" : " disabled") +
                  ">" +
                  escapeText(handoff.message) +
                  "</textarea>" +
                  '<button type="submit"' +
                  (state.isReady && !state.isHandoffSending ? "" : " disabled") +
                  ">" +
                  (state.isHandoffSending ? getSendingLabel(state.locale) : getHandoffSubmitLabel(state.locale)) +
                  "</button>" +
                  "</form>"
                : "") +
              "</div>"
            : "") +
          "</section>"
        : "") +
      "</div>";

    app.querySelector(".pf-launcher").addEventListener("click", function () {
      state.isOpen = !state.isOpen;
      render();
    });

    var closeButton = app.querySelector(".pf-close");
    if (closeButton) {
      closeButton.addEventListener("click", function () {
        state.isOpen = false;
        render();
      });
    }

    var resetButton = app.querySelector(".pf-reset");
    if (resetButton) {
      resetButton.addEventListener("click", resetConversation);
    }

    var form = app.querySelector(".pf-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        ask(form.elements.message.value);
      });
    }

    var handoffToggle = app.querySelector(".pf-handoff-toggle");
    if (handoffToggle) {
      handoffToggle.addEventListener("click", function () {
        state.isHandoffOpen = !state.isHandoffOpen;
        state.handoff.error = "";
        render();
      });
    }

    var handoffForm = app.querySelector(".pf-handoff-form");
    if (handoffForm) {
      handoffForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitHandoff(handoffForm);
      });
    }
  }

  function fetchConfig() {
    return fetch(apiBase.replace(/\/$/, "") + "/public/v1/widget/config/" + encodeURIComponent(tenantSlug), {
      headers: { accept: "application/json" }
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Widget config failed");
      }

      return response.json();
    });
  }

  function ask(message) {
    var trimmed = String(message || "").trim();

    if (!trimmed || state.isSending) {
      return;
    }

    state.messages.push({ role: "user", text: trimmed });
    persistMessages();
    state.isSending = true;
    render();

    fetch(apiBase.replace(/\/$/, "") + "/public/v1/widget/ask/" + encodeURIComponent(tenantSlug), {
      body: JSON.stringify({
        locale: state.locale,
        message: trimmed
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      method: "POST"
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Widget ask failed");
        }

        return response.json();
      })
      .then(function (response) {
        state.messages.push(assistantMessage(response.answer || "I could not produce an answer yet."));
        persistMessages();
      })
      .catch(function () {
        state.messages.push(assistantMessage("I cannot reach the agency knowledge base right now. Please try again in a minute."));
        persistMessages();
      })
      .finally(function () {
        state.isSending = false;
        render();
      });
  }

  function submitHandoff(form) {
    if (state.isHandoffSending) {
      return;
    }

    state.handoff = {
      contactEmail: String(form.elements.contactEmail.value || "").trim(),
      contactName: String(form.elements.contactName.value || "").trim(),
      contactPhone: String(form.elements.contactPhone.value || "").trim(),
      error: "",
      message: String(form.elements.handoffMessage.value || "").trim()
    };

    if (!state.handoff.contactName || (!state.handoff.contactEmail && !state.handoff.contactPhone)) {
      state.handoff.error = getHandoffValidationMessage(state.locale);
      render();
      return;
    }

    state.isHandoffSending = true;
    render();

    fetch(apiBase.replace(/\/$/, "") + "/public/v1/widget/leads/" + encodeURIComponent(tenantSlug), {
      body: JSON.stringify({
        contactEmail: state.handoff.contactEmail || undefined,
        contactName: state.handoff.contactName,
        contactPhone: state.handoff.contactPhone || undefined,
        locale: state.locale,
        message: buildHandoffMessage(state.handoff.message)
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      method: "POST"
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Widget lead failed");
        }

        return response.json();
      })
      .then(function (response) {
        state.messages.push(assistantMessage(response.message || getHandoffSuccessMessage(state.locale)));
        state.handoff = {
          contactEmail: "",
          contactName: "",
          contactPhone: "",
          error: "",
          message: ""
        };
        state.isHandoffOpen = false;
        persistMessages();
      })
      .catch(function () {
        state.handoff.error = getHandoffFailureMessage(state.locale);
      })
      .finally(function () {
        state.isHandoffSending = false;
        render();
      });
  }

  function buildHandoffMessage(customMessage) {
    var recentConversation = state.messages
      .slice(-6)
      .map(function (message) {
        return message.role + ": " + message.text;
      })
      .join("\n");
    var lines = ["Widget handoff request."];

    if (customMessage) {
      lines.push("Visitor note: " + customMessage);
    }

    if (recentConversation) {
      lines.push("Recent widget conversation:\n" + recentConversation);
    }

    return lines.join("\n\n").slice(0, 3000);
  }

  function assistantMessage(text) {
    return { role: "assistant", text: text };
  }

  function resetConversation() {
    state.messages = [assistantMessage(getWelcomeMessage(state.config, state.locale))];
    persistMessages();
    render();
  }

  function loadStoredMessages() {
    try {
      var raw = window.sessionStorage.getItem(getStorageKey());
      var parsed = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(function (message) {
          return (
            message &&
            (message.role === "assistant" || message.role === "user") &&
            typeof message.text === "string" &&
            message.text.trim()
          );
        })
        .map(function (message) {
          return {
            role: message.role,
            text: message.text.slice(0, 2000)
          };
        })
        .slice(-24);
    } catch (_error) {
      return [];
    }
  }

  function persistMessages() {
    try {
      window.sessionStorage.setItem(getStorageKey(), JSON.stringify(state.messages.slice(-24)));
    } catch (_error) {
      return undefined;
    }
  }

  function getStorageKey() {
    return "propertyflow.widget." + tenantSlug + "." + state.locale;
  }

  function mergeConfig(fallback, remote) {
    return {
      aiName: remote.aiName || fallback.aiName,
      aiNames: Object.assign({}, fallback.aiNames, remote.aiNames || {}),
      branding: Object.assign({}, fallback.branding, remote.branding || {}),
      capabilities: Object.assign({}, fallback.capabilities, remote.capabilities || {}),
      conciergeMode: remote.conciergeMode || fallback.conciergeMode,
      languages: Array.isArray(remote.languages) && remote.languages.length ? remote.languages : fallback.languages,
      personaGenders: Object.assign({}, fallback.personaGenders, remote.personaGenders || {}),
      readiness: remote.readiness || fallback.readiness,
      tenantSlug: remote.tenantSlug || fallback.tenantSlug,
      tone: remote.tone || fallback.tone,
      welcomeMessage: remote.welcomeMessage || fallback.welcomeMessage,
      welcomeMessages: Object.assign({}, fallback.welcomeMessages, remote.welcomeMessages || {})
    };
  }

  function readAttribute(element, name, fallback) {
    return element.getAttribute("data-" + name) || fallback;
  }

  function readJsonAttribute(element, name, fallback) {
    try {
      return JSON.parse(readAttribute(element, name, ""));
    } catch (_error) {
      return fallback;
    }
  }

  function inferApiBase(scriptSrc) {
    try {
      var url = new URL(scriptSrc);

      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.protocol + "//" + url.hostname + ":3001";
      }

      if (url.hostname === "cdn.propertyflow.ai") {
        return "https://api.propertyflow.ai";
      }

      return url.origin;
    } catch (_error) {
      return "https://api.propertyflow.ai";
    }
  }

  function resolveRequestedLocale(locale) {
    if (locale && locale !== "auto") {
      return normalizeLocale(locale);
    }

    return normalizeLocale(document.documentElement.lang || navigator.language || "en");
  }

  function normalizeLocale(locale) {
    var normalized = String(locale || "en").toLowerCase();

    if (normalized.indexOf("ru") === 0) {
      return "ru";
    }

    if (normalized.indexOf("th") === 0) {
      return "th";
    }

    if (normalized.indexOf("zh") === 0) {
      return "zh";
    }

    return "en";
  }

  function pickLocale(locale, enabledLanguages) {
    if (enabledLanguages.indexOf(locale) !== -1) {
      return locale;
    }

    return enabledLanguages[0] || "en";
  }

  function getWelcomeMessage(config, locale) {
    return getLocalizedValue(config.welcomeMessages, locale, config.welcomeMessage);
  }

  function getLocalizedValue(values, locale, fallback) {
    return (values && values[locale]) || fallback || "";
  }

  function getPlaceholder(locale) {
    var placeholders = {
      en: "Ask about budget, area, lifestyle, or investment...",
      ru: "Спросите про бюджет, район, жизнь или инвестиции...",
      th: "ถามเรื่องงบประมาณ ทำเล ไลฟ์สไตล์ หรือการลงทุน...",
      zh: "询问预算、区域、生活方式或投资..."
    };

    return placeholders[locale] || placeholders.en;
  }

  function getHandoffCta(locale) {
    var labels = {
      en: "Ask an agent to contact me",
      ru: "Попросить агента связаться",
      th: "ให้เอเจนต์ติดต่อกลับ",
      zh: "让经纪人联系我"
    };

    return labels[locale] || labels.en;
  }

  function getHandoffSubmitLabel(locale) {
    var labels = {
      en: "Send request",
      ru: "Отправить запрос",
      th: "ส่งคำขอ",
      zh: "发送请求"
    };

    return labels[locale] || labels.en;
  }

  function getSendingLabel(locale) {
    var labels = {
      en: "Sending...",
      ru: "Отправляем...",
      th: "กำลังส่ง...",
      zh: "正在发送..."
    };

    return labels[locale] || labels.en;
  }

  function getHandoffNamePlaceholder(locale) {
    var labels = {
      en: "Your name",
      ru: "Ваше имя",
      th: "ชื่อของคุณ",
      zh: "您的姓名"
    };

    return labels[locale] || labels.en;
  }

  function getHandoffPhonePlaceholder(locale) {
    var labels = {
      en: "Phone or WhatsApp",
      ru: "Телефон или WhatsApp",
      th: "โทรศัพท์หรือ WhatsApp",
      zh: "电话或 WhatsApp"
    };

    return labels[locale] || labels.en;
  }

  function getHandoffMessagePlaceholder(locale) {
    var labels = {
      en: "What should the agent help with?",
      ru: "С чем агенту помочь?",
      th: "ต้องการให้เอเจนต์ช่วยเรื่องอะไร?",
      zh: "希望经纪人帮您什么？"
    };

    return labels[locale] || labels.en;
  }

  function getHandoffValidationMessage(locale) {
    var labels = {
      en: "Please add your name and at least email or phone.",
      ru: "Укажите имя и хотя бы email или телефон.",
      th: "กรุณาใส่ชื่อ และอีเมลหรือเบอร์โทรอย่างน้อยหนึ่งอย่าง",
      zh: "请填写姓名，并至少留下邮箱或电话。"
    };

    return labels[locale] || labels.en;
  }

  function getHandoffFailureMessage(locale) {
    var labels = {
      en: "I could not send the request right now. Please try again in a minute.",
      ru: "Не удалось отправить запрос. Попробуйте еще раз через минуту.",
      th: "ยังส่งคำขอไม่ได้ตอนนี้ กรุณาลองใหม่อีกครั้ง",
      zh: "暂时无法发送请求，请稍后再试。"
    };

    return labels[locale] || labels.en;
  }

  function getHandoffSuccessMessage(locale) {
    var labels = {
      en: "Thanks. The agency has your request and can follow up from CRM.",
      ru: "Спасибо. Агентство получило запрос и сможет связаться с вами.",
      th: "ขอบคุณค่ะ เอเจนซี่ได้รับคำขอของคุณแล้วและจะติดต่อกลับ",
      zh: "谢谢。机构已收到您的请求，并会跟进。"
    };

    return labels[locale] || labels.en;
  }

  function sanitizeColor(value) {
    return /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#0f766e";
  }

  function escapeText(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildStyles() {
    return [
      ".pf-shell{position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#12211f}",
      ".pf-launcher{display:flex;align-items:center;gap:10px;border:1px solid color-mix(in srgb,var(--pf-primary),white 55%);background:#fff;box-shadow:0 16px 42px rgba(15,34,30,.18);color:#0b4f49;cursor:pointer;padding:10px 12px;text-align:left}",
      ".pf-launcher:hover{background:#edf8f4}",
      ".pf-launcher-mark{display:grid;width:36px;height:36px;place-items:center;background:var(--pf-primary);color:#fff;font-weight:900}",
      ".pf-launcher strong{display:block;font-size:14px;line-height:1.1}",
      ".pf-launcher small{display:block;color:#66736f;font-size:11px;font-weight:800;text-transform:uppercase}",
      ".pf-panel{position:absolute;right:0;bottom:64px;display:grid;width:min(360px,calc(100vw - 32px));max-height:min(620px,calc(100vh - 104px));border:1px solid color-mix(in srgb,var(--pf-primary),white 55%);background:#fff;box-shadow:0 22px 60px rgba(15,34,30,.22);overflow:hidden}",
      ".pf-panel header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:#0b211d;color:#fff;padding:14px}",
      ".pf-panel header strong{display:block;font-size:16px}",
      ".pf-panel header span{display:block;color:#d8e8e3;font-size:12px;font-weight:800;margin-top:3px}",
      ".pf-header-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}",
      ".pf-reset,.pf-close{border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff;cursor:pointer;font:inherit}",
      ".pf-reset{height:32px;padding:0 9px;font-size:11px;font-weight:900;text-transform:uppercase}",
      ".pf-close{font-size:22px;line-height:1;width:32px;height:32px}",
      ".pf-reset:hover,.pf-close:hover{background:rgba(255,255,255,.12)}",
      ".pf-error{margin:12px 12px 0;border:1px solid #fed7aa;background:#fff7ed;color:#7c4a05;font-size:12px;font-weight:800;line-height:1.4;padding:10px}",
      ".pf-thread{display:grid;gap:10px;max-height:310px;overflow:auto;padding:12px}",
      ".pf-message{border:1px solid #d9e7e3;font-size:14px;font-weight:750;line-height:1.45;padding:10px;white-space:pre-wrap}",
      ".pf-message-assistant{background:#edf8f4;color:#0b4f49}",
      ".pf-message-user{justify-self:end;background:#0b4f49;color:#fff;max-width:88%}",
      ".pf-form{display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:8px;border-top:1px solid #d9e7e3;padding:12px}",
      ".pf-form textarea{min-width:0;resize:none;border:1px solid #d9e7e3;color:#12211f;font:inherit;font-size:13px;font-weight:750;padding:9px}",
      ".pf-form textarea:focus{border-color:var(--pf-primary);outline:none}",
      ".pf-form button{border:0;background:var(--pf-primary);color:#fff;cursor:pointer;font:inherit;font-size:13px;font-weight:900;text-transform:uppercase}",
      ".pf-form button:disabled,.pf-form textarea:disabled{cursor:not-allowed;opacity:.6}",
      ".pf-note{display:block;color:#66736f;font-size:11px;font-weight:800;line-height:1.4;padding:0 12px 12px}",
      ".pf-handoff{border-top:1px solid #d9e7e3;padding:12px}",
      ".pf-handoff-toggle{width:100%;border:1px solid color-mix(in srgb,var(--pf-primary),white 62%);background:#edf8f4;color:#0b4f49;cursor:pointer;font:inherit;font-size:12px;font-weight:900;padding:10px;text-align:center;text-transform:uppercase}",
      ".pf-handoff-toggle:hover{background:#def1eb}",
      ".pf-handoff-form{display:grid;gap:8px;margin-top:10px}",
      ".pf-handoff-form input,.pf-handoff-form textarea{min-width:0;border:1px solid #d9e7e3;color:#12211f;font:inherit;font-size:13px;font-weight:750;padding:9px}",
      ".pf-handoff-form textarea{resize:none}",
      ".pf-handoff-form input:focus,.pf-handoff-form textarea:focus{border-color:var(--pf-primary);outline:none}",
      ".pf-handoff-form button{border:0;background:var(--pf-primary);color:#fff;cursor:pointer;font:inherit;font-size:12px;font-weight:900;padding:10px;text-transform:uppercase}",
      ".pf-handoff-form button:disabled,.pf-handoff-form input:disabled,.pf-handoff-form textarea:disabled{cursor:not-allowed;opacity:.6}",
      ".pf-handoff-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      ".pf-handoff-error{border:1px solid #fed7aa;background:#fff7ed;color:#7c4a05;font-size:12px;font-weight:800;line-height:1.4;margin:0;padding:8px}",
      "@media (max-width:480px){.pf-shell{right:12px;bottom:12px}.pf-panel{bottom:62px;width:calc(100vw - 24px)}}"
    ].join("");
  }
})();
