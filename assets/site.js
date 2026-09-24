/* TRAVEL & FINANCE TIPS — email capture.
   Signups POST into the MailerLite list, and always send a best-effort
   FormSubmit note to Evan's Gmail so no signup is ever lost. */
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

  /* ---- MailerLite list (primary) ----
     Account 2650211, embedded form "Travel and Finance Tips". The endpoint sends
     access-control-allow-origin: *, and a form-urlencoded body keeps this a
     simple request (no preflight). Only {"success": true} counts as subscribed. */
  var MAILERLITE_ENDPOINT = "https://assets.mailerlite.com/jsonp/2650211/forms/199271469674398924/subscribe";

  function sendMailerLite(emailAddr) {
    var body = new URLSearchParams();
    body.append("fields[email]", emailAddr);
    body.append("ml-submit", "1");
    body.append("anticsrf", "true");
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000) : null;
    return fetch(MAILERLITE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: body,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (json) {
      if (!json || json.success !== true) throw new Error("MailerLite rejected");
      return json;
    }).finally(function () {
      if (timer) clearTimeout(timer);
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

      // Inbox copy goes out regardless of the list result, so no signup is lost.
      sendForm(payload).catch(function () {});

      sendMailerLite(email.value).then(function () {
        if (note) note.textContent = "You're in — one useful email a week, and one click to leave anytime.";
        form.reset();
      }).catch(function () {
        if (note) note.textContent = "Something went wrong — please try again in a moment.";
      }).finally(function () {
        if (btn) btn.disabled = false;
      });
    });
  });

  /* ---- Contact form (Lily 2026-09-23) ----
     Same FormSubmit inbox as signups; the _subject tells them apart. */
  document.querySelectorAll("form[data-contact]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector(".form-success");
      var btn = form.querySelector('button[type="submit"]');
      var honeypot = form.querySelector('input[name="company"]');
      if (honeypot && honeypot.value) { if (note) note.textContent = "Thanks, message sent."; form.reset(); return; }
      var fields = form.querySelectorAll("input[required], textarea[required]");
      for (var i = 0; i < fields.length; i++) { if (!fields[i].checkValidity()) { fields[i].reportValidity(); return; } }
      if (btn) btn.disabled = true;
      if (note) note.textContent = "Sending…";
      sendForm({
        name: form.querySelector('[name="name"]').value,
        email: form.querySelector('[name="email"]').value,
        topic: form.querySelector('[name="topic"]').value,
        message: form.querySelector('[name="message"]').value,
        _subject: "Travel & Finance Tips — contact form",
        _template: "table"
      }).then(function () {
        if (note) note.textContent = "Thanks, message sent. I'll reply within two business days.";
        form.reset();
      }).catch(function () {
        if (note) note.textContent = "That didn't go through. Please try again in a minute.";
      }).finally(function () { if (btn) btn.disabled = false; });
    });
  });
})();
