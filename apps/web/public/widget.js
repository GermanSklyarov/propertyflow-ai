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
      crmLeadCapture: embedMode === "growth" || embedMode === "enterprise",
      knowledgeAnswers: true,
      leadCapture: true,
      leadQualification: true,
      propertySearch: true
    },
    conciergeMode: embedMode,
    languages: readAttribute(script, "languages", "en").split(",").filter(Boolean),
    leadQualificationFields: readAttribute(
      script,
      "lead-qualification-fields",
      "budget,preferredArea,bedrooms,investmentPurpose,moveInDate,financing,whatsapp,email,phone"
    )
      .split(",")
      .filter(Boolean),
    listingUrlTemplate: readAttribute(script, "listing-url-template", "/listings/:propertyId"),
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
    messages: [],
    runtimeError: ""
  };
  var handoffIntentPatterns = [
    /(просмотр|посмотр|запис|связ|позвон|телефон|ватсап|вотсап|почт|контакт|агент|заявк)/i,
    /(viewing|schedule|book|contact|call|phone|agent|email|handoff|whatsapp)/i,
    /(นัดดู|ดูห้อง|ดูคอนโด|ติดต่อ|โทร|เบอร์|อีเมล|อีเมล์|เอเจนต์|นายหน้า|ไลน์|line|whatsapp)/i,
    /(看房|预约|預約|联系|聯繫|电话|電話|手机|手機|微信|邮箱|郵箱|邮件|郵件|经纪人|經紀人|中介|whatsapp)/i
  ];
  var searchIntentPatterns = [
    /(найд|подбер|покаж|посовет|вариант|кондо|квартир|дом|студи|район|инвест|аренд|снять|купить)/i,
    /(listing|property|condo|apartment|house|rent|buy|recommend|suggest|area|investment|budget|bedroom)/i,
    /(หา|ค้นหา|แนะนำ|ตัวเลือก|คอนโด|อพาร์ตเมนต์|บ้าน|เช่า|ซื้อ|ทำเล|ย่าน|ลงทุน|งบ|ห้องนอน)/i,
    /(找|寻找|搜尋|搜索|推荐|推薦|房源|公寓|共管公寓|房子|住宅|租|买|買|区域|區域|地段|投资|投資|预算|預算|卧室|臥室)/i
  ];

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
      state.runtimeError = "";
      state.messages = loadStoredMessages();
      if (!state.messages.length) {
        state.messages = [assistantMessage(getWelcomeMessage(state.config, state.locale))];
        persistMessages();
      }
      render();
    })
    .catch(function (error) {
      state.locale = pickLocale(requestedLocale, state.config.languages);
      state.messages = loadStoredMessages();
      if (!state.messages.length) {
        state.messages = [assistantMessage(getWelcomeMessage(state.config, state.locale))];
        persistMessages();
      }
      state.runtimeError = getConfigFailureMessage(error);
      render();
    });

  render();

  function render() {
    var config = state.config;
    var primaryColor = sanitizeColor(config.branding.primaryColor || "#0f766e");
    var displayName = escapeText(config.branding.displayName || "PropertyFlowAI");
    var aiName = escapeText(getLocalizedValue(config.aiNames, state.locale, config.aiName || "Anna"));
    var mode = escapeText(config.conciergeMode || "starter");
    var canCreateLead = config.capabilities && config.capabilities.leadCapture === true;
    var languageLabel = escapeText(state.locale.toUpperCase());
    var handoff = state.handoff;
    var readinessNotice = buildReadinessNotice(config.readiness, state.locale);
    var resetLabel = escapeText(getResetLabel(state.locale));
    var askLabel = escapeText(getAskLabel(state.locale));
    var thinkingLabel = escapeText(getThinkingLabel(state.locale));
    var noteLabel = escapeText(getWidgetNote(state.locale));
    var launcherSubtitle = escapeText(getLauncherSubtitle(state.locale));
    var askColumn = escapeText(getAskColumnSize(state.locale));
    var messages = state.messages
      .map(function (message) {
        return (
          '<div class="pf-message pf-message-' +
          message.role +
          '">' +
          escapeText(message.text) +
          buildRecommendationsHtml(message.recommendations) +
          "</div>"
        );
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
      '</strong><small>' +
      launcherSubtitle +
      "</small></span>" +
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
          '</span></div><div class="pf-header-actions"><button class="pf-reset" type="button">' +
          resetLabel +
          '</button><button class="pf-close" type="button" aria-label="Close">×</button></div></header>' +
          (readinessNotice ? '<p class="pf-readiness pf-readiness-' + readinessNotice.status + '">' + escapeText(readinessNotice.message) + "</p>" : "") +
          (state.runtimeError ? '<p class="pf-error">' + escapeText(state.runtimeError) + "</p>" : "") +
          '<div class="pf-thread">' +
          messages +
          (state.isSending ? '<div class="pf-message pf-message-assistant">' + thinkingLabel + "</div>" : "") +
          "</div>" +
          '<div class="pf-footer' +
          (state.isHandoffOpen ? " pf-footer-expanded" : "") +
          '">' +
          '<form class="pf-form" style="--pf-ask-column:' +
          askColumn +
          '">' +
          '<textarea name="message" rows="2" placeholder="' +
          escapeText(getPlaceholder(state.locale)) +
          '"' +
          (state.isReady ? "" : " disabled") +
          "></textarea>" +
          '<button type="submit"' +
          (state.isReady && !state.isSending ? "" : " disabled") +
          ">" +
          askLabel +
          "</button>" +
          "</form>" +
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
          '<small class="pf-note">' +
          noteLabel +
          "</small>" +
          "</div>" +
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

    scrollThreadToBottom();
  }

  function scrollThreadToBottom() {
    if (!state.isOpen) {
      return;
    }

    var thread = app.querySelector(".pf-thread");
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }

  function fetchConfig() {
    return fetch(apiBase.replace(/\/$/, "") + "/public/v1/widget/config/" + encodeURIComponent(tenantSlug), {
      headers: { accept: "application/json" }
    }).then(function (response) {
      if (!response.ok) {
        var error = new Error("Widget config failed");
        error.status = response.status;
        throw error;
      }

      return response.json();
    });
  }

  function getConfigFailureMessage(error) {
    if (error && error.status === 403) {
      return "This page origin is not allowed for the AI Concierge widget. Add this website origin in PropertyFlowAI settings, then reload the page.";
    }

    return "The concierge could not load live tenant configuration. Live knowledge answers are unavailable right now.";
  }

  function buildReadinessNotice(readiness, locale) {
    if (!readiness || readiness.status === "ready") {
      return null;
    }

    return {
      message: localizeReadinessMessage(readiness, locale),
      status: readiness.status === "needs-setup" ? "needs-setup" : "test-mode"
    };
  }

  function buildRecommendationsHtml(recommendations) {
    var listings = normalizeRecommendedListings(recommendations);

    if (!listings.length) {
      return "";
    }

    return (
      '<div class="pf-recommendations">' +
      listings
        .map(function (listing) {
          return (
            '<a href="' +
            escapeText(listing.url) +
            '" target="_blank" rel="noopener noreferrer">' +
            '<span>' +
            escapeText(listing.title) +
            '</span><small>' +
            escapeText(getViewListingLabel(state.locale)) +
            "</small></a>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function normalizeRecommendedListings(recommendations) {
    if (!Array.isArray(recommendations)) {
      return [];
    }

    return recommendations
      .filter(function (listing) {
        return listing && typeof listing.title === "string" && isSafeListingUrl(listing.url);
      })
      .map(function (listing) {
        return {
          title: listing.title.trim().slice(0, 120),
          url: String(listing.url)
        };
      })
      .filter(function (listing) {
        return listing.title;
      })
      .slice(0, 3);
  }

  function isSafeListingUrl(value) {
    try {
      var url = new URL(String(value));

      return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch (_error) {
      return false;
    }
  }

  function throwWidgetHttpError(message, response) {
    var error = new Error(message);
    error.status = response.status;
    throw error;
  }

  function ask(message) {
    var trimmed = String(message || "").trim();

    if (!trimmed || state.isSending) {
      return;
    }

    var conversation = buildConversationHistory(trimmed);
    state.messages.push({ role: "user", text: trimmed });
    persistMessages();
    state.isSending = true;
    render();

    fetch(apiBase.replace(/\/$/, "") + "/public/v1/widget/ask/" + encodeURIComponent(tenantSlug), {
      body: JSON.stringify({
        conversation: conversation,
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
          throwWidgetHttpError("Widget ask failed", response);
        }

        return response.json();
      })
      .then(function (response) {
        var recommendations = shouldShowRecommendations(trimmed) ? response.recommendedListings : [];
        state.messages.push(
          assistantMessage(response.answer || getEmptyAnswerMessage(state.locale), recommendations)
        );
        persistMessages();
      })
      .catch(function (error) {
        state.messages.push(assistantMessage(getAskFailureMessage(state.locale, error)));
        persistMessages();
      })
      .finally(function () {
        state.isSending = false;
        render();
      });
  }

  function buildConversationHistory(nextMessage) {
    return state.messages
      .filter(function (message) {
        return (
          message &&
          (message.role === "assistant" || message.role === "user") &&
          typeof message.text === "string" &&
          message.text.trim()
        );
      })
      .concat([{ role: "user", text: nextMessage }])
      .slice(-10)
      .map(function (message) {
        return {
          recommendedListings: normalizeRecommendedListings(message.recommendations).map(function (listing) {
            return {
              propertyId: listing.propertyId,
              title: listing.title
            };
          }),
          role: message.role,
          text: message.text.slice(0, 1000)
        };
      });
  }

  function shouldShowRecommendations(message) {
    var normalized = String(message || "")
      .toLowerCase()
      .replaceAll("ё", "е")
      .trim();

    if (!normalized) {
      return false;
    }

    if (matchesIntent(normalized, handoffIntentPatterns)) {
      return false;
    }

    return matchesIntent(normalized, searchIntentPatterns);
  }

  function matchesIntent(message, patterns) {
    return patterns.some(function (pattern) {
      return pattern.test(message);
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
        conversation: buildConversationHistory(""),
        locale: state.locale,
        message: state.handoff.message || undefined,
        recommendedListings: getRecentRecommendedListings()
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      method: "POST"
    })
      .then(function (response) {
        if (!response.ok) {
          throwWidgetHttpError("Widget lead failed", response);
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
      .catch(function (error) {
        state.handoff.error = getHandoffFailureMessage(state.locale, error);
      })
      .finally(function () {
        state.isHandoffSending = false;
        render();
      });
  }

  function getRecentRecommendedListings() {
    return state.messages
      .slice()
      .reverse()
      .flatMap(function (message) {
        return normalizeRecommendedListings(message.recommendations);
      })
      .filter(function (listing, index, listings) {
        return listings.findIndex(function (candidate) {
          return candidate.propertyId === listing.propertyId;
        }) === index;
      })
      .slice(0, 3)
      .map(function (listing) {
        return {
          propertyId: listing.propertyId,
          title: listing.title
        };
      });
  }

  function assistantMessage(text, recommendations) {
    return { recommendations: normalizeRecommendedListings(recommendations), role: "assistant", text: text };
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
            recommendations: normalizeRecommendedListings(message.recommendations),
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
      listingUrlTemplate: remote.listingUrlTemplate || fallback.listingUrlTemplate,
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

  function getLauncherSubtitle(locale) {
    var labels = {
      en: "AI property concierge",
      ru: "AI-консьерж по недвижимости",
      th: "AI Concierge อสังหา",
      zh: "AI 房产礼宾"
    };

    return labels[locale] || labels.en;
  }

  function getResetLabel(locale) {
    var labels = {
      en: "Start over",
      ru: "Начать заново",
      th: "เริ่มใหม่",
      zh: "重新开始"
    };

    return labels[locale] || labels.en;
  }

  function getAskLabel(locale) {
    var labels = {
      en: "Ask",
      ru: "Спросить",
      th: "ถาม",
      zh: "提问"
    };

    return labels[locale] || labels.en;
  }

  function getAskColumnSize(locale) {
    var sizes = {
      en: "74px",
      ru: "minmax(96px,max-content)",
      th: "74px",
      zh: "64px"
    };

    return sizes[locale] || sizes.en;
  }

  function getThinkingLabel(locale) {
    var labels = {
      en: "Thinking...",
      ru: "Думаю...",
      th: "กำลังคิด...",
      zh: "思考中..."
    };

    return labels[locale] || labels.en;
  }

  function getEmptyAnswerMessage(locale) {
    var labels = {
      en: "I could not produce an answer yet.",
      ru: "Пока не получилось подготовить ответ.",
      th: "ตอนนี้ยังสร้างคำตอบไม่ได้",
      zh: "暂时无法生成回答。"
    };

    return labels[locale] || labels.en;
  }

  function getWidgetNote(locale) {
    var labels = {
      en: "Answers use this agency knowledge base and listings. CRM is not required for Starter mode.",
      ru: "Ответы используют базу знаний и объекты агентства. CRM не требуется для Starter.",
      th: "คำตอบใช้ฐานความรู้และประกาศของเอเจนซี่ โหมด Starter ไม่ต้องใช้ CRM",
      zh: "回答基于机构知识库和房源。Starter 模式不需要 CRM。"
    };

    return labels[locale] || labels.en;
  }

  function localizeReadinessMessage(readiness, locale) {
    var labels = {
      ready: {
        en: "Widget configuration is ready for production installation.",
        ru: "Виджет готов к установке на сайт.",
        th: "วิดเจ็ตพร้อมติดตั้งบนเว็บไซต์จริงแล้ว",
        zh: "小组件已准备好上线安装。"
      },
      "needs-setup": {
        en: "Finish widget setup in PropertyFlowAI before sharing this assistant with live visitors.",
        ru: "Завершите настройку виджета в PropertyFlowAI перед запуском для посетителей.",
        th: "ตั้งค่าวิดเจ็ตใน PropertyFlowAI ให้เสร็จก่อนเปิดให้ผู้เข้าชมใช้งานจริง",
        zh: "请先在 PropertyFlowAI 中完成小组件设置，再开放给访客使用。"
      },
      "test-mode": {
        en: "Add production website origins before sharing the widget with live visitors.",
        ru: "Добавьте origin боевого сайта перед запуском виджета для посетителей.",
        th: "เพิ่ม origin ของเว็บไซต์จริงก่อนเปิดวิดเจ็ตให้ผู้เข้าชมใช้งาน",
        zh: "请先添加正式网站 origin，再开放小组件给访客使用。"
      }
    };
    var status = readiness && readiness.status === "needs-setup" ? "needs-setup" : readiness && readiness.status === "ready" ? "ready" : "test-mode";

    return labels[status][locale] || labels[status].en;
  }

  function getAskFailureMessage(locale, error) {
    if (error && error.status === 403) {
      var blocked = {
        en: "This page is not allowed to use the AI Concierge yet. Ask the agency to add this website origin in PropertyFlowAI settings.",
        ru: "Эта страница пока не разрешена для AI-консьержа. Попросите агентство добавить origin сайта в настройках PropertyFlowAI.",
        th: "หน้านี้ยังไม่ได้รับอนุญาตให้ใช้ AI Concierge กรุณาให้เอเจนซี่เพิ่ม origin ของเว็บไซต์ใน PropertyFlowAI settings",
        zh: "此页面尚未被允许使用 AI Concierge。请让机构在 PropertyFlowAI 设置中添加该网站 origin。"
      };

      return blocked[locale] || blocked.en;
    }

    var labels = {
      en: "I cannot reach the agency knowledge base right now. Please try again in a minute.",
      ru: "Сейчас я не могу подключиться к базе знаний агентства. Попробуйте еще раз через минуту.",
      th: "ตอนนี้ยังเชื่อมต่อฐานความรู้ของเอเจนซี่ไม่ได้ กรุณาลองใหม่อีกครั้ง",
      zh: "我现在无法连接机构知识库，请稍后再试。"
    };

    return labels[locale] || labels.en;
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

  function getViewListingLabel(locale) {
    var labels = {
      en: "View listing",
      ru: "Открыть объект",
      th: "ดูประกาศ",
      zh: "查看房源"
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

  function getHandoffFailureMessage(locale, error) {
    if (error && error.status === 403) {
      var blocked = {
        en: "This page is not allowed to send Concierge handoff requests yet. Ask the agency to add this website origin in PropertyFlowAI settings.",
        ru: "Эта страница пока не может отправлять заявки консьержа. Попросите агентство добавить origin сайта в настройках PropertyFlowAI.",
        th: "หน้านี้ยังไม่ได้รับอนุญาตให้ส่งคำขอจาก Concierge กรุณาให้เอเจนซี่เพิ่ม origin ของเว็บไซต์ใน PropertyFlowAI settings",
        zh: "此页面尚未被允许发送 Concierge 转交请求。请让机构在 PropertyFlowAI 设置中添加该网站 origin。"
      };

      return blocked[locale] || blocked.en;
    }

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
      en: "Thanks. The agency has your qualified request and can follow up.",
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
      ".pf-panel{position:absolute;right:0;bottom:64px;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;width:min(360px,calc(100vw - 32px));height:min(620px,calc(100vh - 104px));border:1px solid color-mix(in srgb,var(--pf-primary),white 55%);background:#fff;box-shadow:0 22px 60px rgba(15,34,30,.22);overflow:hidden}",
      ".pf-panel header{grid-row:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:#0b211d;color:#fff;padding:14px}",
      ".pf-panel header strong{display:block;font-size:16px}",
      ".pf-panel header span{display:block;color:#d8e8e3;font-size:12px;font-weight:800;margin-top:3px}",
      ".pf-header-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}",
      ".pf-reset,.pf-close{border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff;cursor:pointer;font:inherit}",
      ".pf-reset{height:32px;padding:0 9px;font-size:11px;font-weight:900;text-transform:uppercase}",
      ".pf-close{font-size:22px;line-height:1;width:32px;height:32px}",
      ".pf-reset:hover,.pf-close:hover{background:rgba(255,255,255,.12)}",
      ".pf-readiness{grid-row:2;margin:12px 12px 0;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4d8f;font-size:12px;font-weight:850;line-height:1.4;padding:10px}",
      ".pf-readiness-needs-setup{border-color:#fed7aa;background:#fff7ed;color:#7c4a05}",
      ".pf-error{grid-row:3;margin:12px 12px 0;border:1px solid #fed7aa;background:#fff7ed;color:#7c4a05;font-size:12px;font-weight:800;line-height:1.4;padding:10px}",
      ".pf-thread{grid-row:4;display:grid;align-content:start;gap:10px;min-height:0;overflow:auto;padding:12px}",
      ".pf-message{border:1px solid #d9e7e3;font-size:14px;font-weight:750;line-height:1.45;padding:10px;white-space:pre-wrap}",
      ".pf-message-assistant{background:#edf8f4;color:#0b4f49}",
      ".pf-message-user{justify-self:end;background:#0b4f49;color:#fff;max-width:88%}",
      ".pf-recommendations{display:grid;gap:7px;margin-top:9px;white-space:normal}",
      ".pf-recommendations a{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid color-mix(in srgb,var(--pf-primary),white 58%);background:#fff;color:#0b4f49;padding:8px;text-decoration:none}",
      ".pf-recommendations a:hover{background:#f7fffc}",
      ".pf-recommendations span{font-size:12px;font-weight:900;line-height:1.25}",
      ".pf-recommendations small{flex:0 0 auto;color:var(--pf-primary);font-size:10px;font-weight:950;text-transform:uppercase}",
      ".pf-footer{grid-row:5;display:grid;gap:8px;border-top:1px solid #d9e7e3;background:#fff;padding:12px}",
      ".pf-footer-expanded{max-height:min(320px,48vh);overflow:auto}",
      ".pf-form{display:grid;grid-template-columns:minmax(0,1fr) var(--pf-ask-column,74px);gap:8px}",
      ".pf-form textarea{min-width:0;resize:none;border:1px solid #d9e7e3;color:#12211f;font:inherit;font-size:13px;font-weight:750;padding:9px}",
      ".pf-form textarea:focus{border-color:var(--pf-primary);outline:none}",
      ".pf-form button{min-width:0;border:0;background:var(--pf-primary);color:#fff;cursor:pointer;font:inherit;font-size:13px;font-weight:900;line-height:1.15;overflow-wrap:anywhere;padding:0 10px;text-transform:uppercase;white-space:normal}",
      ".pf-form button:disabled,.pf-form textarea:disabled{cursor:not-allowed;opacity:.6}",
      ".pf-note{display:block;color:#66736f;font-size:11px;font-weight:800;line-height:1.4}",
      ".pf-handoff{display:grid;gap:8px}",
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
