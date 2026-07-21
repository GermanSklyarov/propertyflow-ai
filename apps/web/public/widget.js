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
  var requestedLocale = resolveRequestedLocale(readAttribute(script, "locale", "auto"));
  var fallbackConfig = {
    aiName: readAttribute(script, "ai-name", "Anna"),
    aiNames: readJsonAttribute(script, "ai-names", {}),
    branding: {
      displayName: "PropertyFlowAI",
      primaryColor: "#0f766e"
    },
    conciergeMode: readAttribute(script, "mode", "starter"),
    languages: readAttribute(script, "languages", "en").split(",").filter(Boolean),
    personaGenders: readJsonAttribute(script, "persona-genders", {}),
    tenantSlug: tenantSlug,
    tone: readAttribute(script, "tone", "friendly"),
    welcomeMessage: readAttribute(script, "welcome-message", "Hi! I can help you find the right property."),
    welcomeMessages: readJsonAttribute(script, "welcome-messages", {})
  };

  var state = {
    config: fallbackConfig,
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
      state.messages = [assistantMessage(getWelcomeMessage(state.config, state.locale))];
      render();
    })
    .catch(function () {
      state.locale = pickLocale(requestedLocale, state.config.languages);
      state.messages = [assistantMessage(getWelcomeMessage(state.config, state.locale))];
      render("The concierge is running from embedded settings. Live knowledge answers are unavailable right now.");
    });

  render();

  function render(errorMessage) {
    var config = state.config;
    var primaryColor = sanitizeColor(config.branding.primaryColor || "#0f766e");
    var displayName = escapeText(config.branding.displayName || "PropertyFlowAI");
    var aiName = escapeText(getLocalizedValue(config.aiNames, state.locale, config.aiName || "Anna"));
    var mode = escapeText(config.conciergeMode || "starter");
    var languageLabel = escapeText(state.locale.toUpperCase());
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
          '</span></div><button class="pf-close" type="button" aria-label="Close">×</button></header>' +
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

    var form = app.querySelector(".pf-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        ask(form.elements.message.value);
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
      })
      .catch(function () {
        state.messages.push(assistantMessage("I cannot reach the agency knowledge base right now. Please try again in a minute."));
      })
      .finally(function () {
        state.isSending = false;
        render();
      });
  }

  function assistantMessage(text) {
    return { role: "assistant", text: text };
  }

  function mergeConfig(fallback, remote) {
    return {
      aiName: remote.aiName || fallback.aiName,
      aiNames: Object.assign({}, fallback.aiNames, remote.aiNames || {}),
      branding: Object.assign({}, fallback.branding, remote.branding || {}),
      conciergeMode: remote.conciergeMode || fallback.conciergeMode,
      languages: Array.isArray(remote.languages) && remote.languages.length ? remote.languages : fallback.languages,
      personaGenders: Object.assign({}, fallback.personaGenders, remote.personaGenders || {}),
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
      ".pf-close{border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff;cursor:pointer;font-size:22px;line-height:1;width:32px;height:32px}",
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
      "@media (max-width:480px){.pf-shell{right:12px;bottom:12px}.pf-panel{bottom:62px;width:calc(100vw - 24px)}}"
    ].join("");
  }
})();
