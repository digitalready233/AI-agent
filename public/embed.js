/**
 * DigiSales.ai website embed — floating chat launcher.
 *
 * Usage (before </body>):
 * <script
 *   src="https://YOUR-DOMAIN.com/embed.js"
 *   data-base="https://YOUR-DOMAIN.com"
 *   data-agent-id="YOUR_AGENT_UUID"
 *   defer
 * ></script>
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var base = (script.getAttribute("data-base") || "").replace(/\/$/, "");
  if (!base && script.src) {
    base = script.src.replace(/\/embed\.js.*$/, "");
  }
  if (!base) return;

  var agentId = (script.getAttribute("data-agent-id") || "").trim();
  var position = script.getAttribute("data-position") === "left" ? "left" : "right";
  var label = script.getAttribute("data-label") || "Chat with us";

  var chatUrl =
    base +
    (agentId
      ? "/live-agent/" + encodeURIComponent(agentId) + "?embed=1"
      : "/embed");

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", label);
  launcher.innerHTML =
    '<span style="display:inline-flex;align-items:center;gap:8px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#f8fafc;">' +
    '<span style="width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 8px rgba(52,211,153,.8);"></span>' +
    label +
    "</span>";

  var launcherSide = position === "left" ? "left:1.25rem;" : "right:1.25rem;";
  launcher.setAttribute(
    "style",
    "position:fixed;bottom:1.25rem;" +
      launcherSide +
      "z-index:99998;padding:0.85rem 1.15rem;border:none;border-radius:999px;cursor:pointer;" +
      "background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);box-shadow:0 8px 32px rgba(0,0,0,.45),0 0 0 1px rgba(34,211,238,.25);"
  );

  var panel = document.createElement("div");
  panel.setAttribute(
    "style",
    "display:none;position:fixed;bottom:5.5rem;" +
      (position === "left" ? "left:1rem;" : "right:1rem;") +
      "z-index:99999;width:min(420px,calc(100vw - 2rem));height:min(640px,calc(100vh - 7rem));" +
      "border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55);background:#0f172a;"
  );

  var iframe = document.createElement("iframe");
  iframe.src = chatUrl;
  iframe.title = label;
  iframe.setAttribute("allow", "microphone");
  iframe.setAttribute(
    "style",
    "width:100%;height:100%;border:0;display:block;background:#0f172a;"
  );
  panel.appendChild(iframe);

  var open = false;
  function toggle() {
    open = !open;
    panel.style.display = open ? "block" : "none";
  }

  launcher.addEventListener("click", toggle);

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
})();
