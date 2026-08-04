/* TRAVEL & FINANCE TIPS — email capture.
   Signups POST into a Mailchimp audience when configured, and always send a
   best-effort FormSubmit note to Evan's Gmail so no signup is ever lost. */
(function () {
  "use strict";

  /* ---- FormSubmit fallback (always on) ----
     Random-string alias hides the destination inbox from scrapers. Routes to
     Evan's Gmail; brand is disambiguated by the _subject line below. */
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/939083f9927a031c7a6c93dad38d05df";

  function sendForm(payload) {
    return fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (json) {
      var ok = json && (json.success === true || json.success === "true");
      if (!ok) throw new Error("FormSubmit rejected");
      return json;
    });
  }

  /* ---- Mailchimp audience (primary list, when configured) ----
     TO TURN ON — from Mailchimp: Audience -> Signup forms -> Embedded forms.
       1) action: the <form action="..."> URL, e.g.
          https://travelfinancetips.us21.list-manage.com/subscribe/post?u=XXX&id=YYY
       2) botField: the hidden anti-bot input's name, e.g. b_XXX_YYY
     Until action is filled in, signups fall back to FormSubmit above. */
  var MAILCHIMP = {
    action: "",
    botField: ""
  };

  var mcSeq = 0;
  function sendMailchimp(data) {
    return new Promise(function (resolve, reject) {
      if (!MAILCHIMP.action) { reject(new Error("Mailchimp not configured")); return; }
      var url = MAILCHIMP.action.replace("/post?", "/post-json?").replace(/\/post$/, "/post-json");
      var cb = "mc_cb_" + (++mcSeq);
      var parts = ["EMAIL=" + encodeURIComponent(data.email)];
      if (MAILCHIMP.botField) parts.push(encodeURIComponent(MAILCHIMP.botField) + "=");
      url += (url.indexOf("?") === -1 ? "?" : "&") + parts.join("&") + "&c=" + cb;
      var script = document.createElement("script");
      var done = false;
      var cleanup = function () {
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      };
      window[cb] = function (resp) {
        if (done) return; done = true; cleanup();
        var already = resp && resp.msg && /already/i.test(resp.msg);
        if (resp && (resp.result === "success" || already)) resolve(resp);
        else reject(new Error((resp && resp.msg) || "Mailchimp error"));
      };
      script.onerror = function () { if (!done) { done = true; cleanup(); reject(new Error("Network error")); } };
      script.src = url;
      document.body.appendChild(script);
      setTimeout(function () { if (!done) { done = true; cleanup(); reject(new Error("Timeout")); } }, 10000);
    });
  }

  document.querySelectorAll("form[data-capture]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector(".form-success");
      var email = form.querySelector('input[type="email"]');
      var btn = form.querySelector('button[type="submit"]');
      // Honeypot: bots fill the hidden field -> fake success, send nothing.
      var honeypot = form.querySelector('input[name="company"]');
      if (honeypot && honeypot.value) {
        if (note) note.textContent = "You're on the list — thanks!";
        form.reset();
        return;
      }
      if (email && !email.checkValidity()) { email.reportValidity(); return; }
      if (btn) btn.disabled = true;
      if (note) note.textContent = "Adding you to the list…";

      var payload = {
        email: email.value,
        _subject: "Travel & Finance Tips — newsletter signup",
        _template: "table"
      };

      var subscribe = MAILCHIMP.action
        ? sendMailchimp({ email: email.value })
            .then(function (r) { sendForm(payload).catch(function () {}); return r; })
        : sendForm(payload);

      subscribe.then(function () {
        if (note) note.textContent = "You're in — one useful email a week, and one click to leave anytime.";
        form.reset();
      }).catch(function () {
        if (note) note.textContent = "Something went wrong — please try again in a moment.";
      }).finally(function () {
        if (btn) btn.disabled = false;
      });
    });
  });
})();
