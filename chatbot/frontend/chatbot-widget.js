/*
 * Windows XP-styled portfolio chatbot widget (vanilla JS, no build step).
 *
 * Usage — add to any HTML page:
 *   <link rel="stylesheet" href="chatbot-widget.css">
 *   <script>window.PORTFOLIO_CHATBOT = { apiUrl: "http://localhost:8000" };</script>
 *   <script src="chatbot-widget.js" defer></script>
 *
 * Config (all optional) via window.PORTFOLIO_CHATBOT:
 *   apiUrl   - backend base URL (default "http://localhost:8000")
 *   title    - window title text
 *   greeting - first bot message
 */
(function () {
  "use strict";

  var cfg = window.PORTFOLIO_CHATBOT || {};
  var API_URL = (cfg.apiUrl || "http://localhost:8000").replace(/\/$/, "");
  var TITLE = cfg.title || "Portfolio Assistant";
  var GREETING =
    cfg.greeting ||
    "Hi! I'm the site's assistant. Ask me about Michael's projects, skills, or how to get around this XP desktop.";

  // Conversation history sent to the backend (excludes the current message).
  var history = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // --- Build DOM ---------------------------------------------------------
  var launcher = el("div", "xpc-launcher");
  launcher.appendChild(el("span", "xpc-launcher-icon", "💬")); // 💬
  launcher.appendChild(el("span", null, "Ask about this site"));

  var win = el("div", "xpc-window");

  var titlebar = el("div", "xpc-titlebar");
  var titleWrap = el("div", "xpc-title");
  titleWrap.appendChild(el("span", null, "💻")); // 💻
  titleWrap.appendChild(el("span", null, TITLE));
  var closeBtn = el("div", "xpc-close", "×"); // ×
  titlebar.appendChild(titleWrap);
  titlebar.appendChild(closeBtn);

  var messages = el("div", "xpc-messages");

  var inputbar = el("div", "xpc-inputbar");
  var input = el("input", "xpc-input");
  input.type = "text";
  input.placeholder = "Type your question...";
  input.maxLength = 2000;
  var sendBtn = el("button", "xpc-send", "Send");
  inputbar.appendChild(input);
  inputbar.appendChild(sendBtn);

  win.appendChild(titlebar);
  win.appendChild(messages);
  win.appendChild(inputbar);

  document.body.appendChild(launcher);
  document.body.appendChild(win);

  // --- Rendering ---------------------------------------------------------
  function addMessage(role, text) {
    var row = el("div", "xpc-msg " + (role === "user" ? "xpc-user" : "xpc-bot"));
    var bubble = el("div", "xpc-msg-bubble", text);
    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function addSources(bubble, sources) {
    if (!sources || !sources.length) return;
    var wrap = el("div", "xpc-sources");
    var seen = {};
    sources.forEach(function (s) {
      var label = s.title || s.source;
      if (seen[label]) return;
      seen[label] = true;
      wrap.appendChild(el("span", "xpc-source-chip", label));
    });
    bubble.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  // --- Networking --------------------------------------------------------
  function send() {
    var text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";
    setBusy(true);

    var typing = addMessage("bot", "typing…");
    typing.classList.add("xpc-typing");

    fetch(API_URL + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        typing.classList.remove("xpc-typing");
        typing.textContent = data.answer || "(no answer)";
        addSources(typing, data.sources);
        history.push({ role: "user", content: text });
        history.push({ role: "assistant", content: data.answer || "" });
      })
      .catch(function (err) {
        typing.classList.remove("xpc-typing");
        typing.textContent =
          "Sorry, I couldn't reach the assistant right now. (" + err.message + ")";
      })
      .finally(function () {
        setBusy(false);
        input.focus();
      });
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    input.disabled = busy;
  }

  // --- Wiring ------------------------------------------------------------
  var greeted = false;
  function openWin() {
    win.classList.add("xpc-open");
    launcher.style.display = "none";
    if (!greeted) {
      addMessage("bot", GREETING);
      greeted = true;
    }
    input.focus();
  }
  function closeWin() {
    win.classList.remove("xpc-open");
    launcher.style.display = "flex";
  }

  launcher.addEventListener("click", openWin);
  closeBtn.addEventListener("click", closeWin);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });
})();
