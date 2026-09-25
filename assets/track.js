/* track.js — per-post conversion tracking for travelfinancetips.com (Dev 2026-09-23).
 *
 * Each post's bio/CTA link carries ?src=<post-slug>. This script:
 *   1. remembers that slug for 30 days (localStorage "tf_src"; no personal data, no cookie),
 *   2. stamps it onto every Stripe buy link as client_reference_id, so each sale is tied to
 *      the post that drove it (read back by the delivery Worker's /claim),
 *   3. beacons every outbound click {src, link, page} to the Worker's /c endpoint.
 * ENDPOINT = the tf-store-delivery Worker /c route (live since 2026-09-25); if it is ever emptied,
 * only step 2 runs and the page behaves exactly as before. Links always navigate normally — the beacon
 * never delays or blocks a click.
 */
(function () {
  var ENDPOINT = "https://tf-store-delivery.tf-store-delivery.workers.dev/c"; // Worker live 2026-09-25 (Dev)
  var KEY = "tf_src", DAYS = 30;

  function clean(v) {
    var s = String(v || "").toLowerCase().trim();
    return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(s) ? s : "";
  }

  var src = "";
  try { src = clean(new URLSearchParams(window.location.search).get("src")); } catch (e) {}
  try {
    if (src) {
      localStorage.setItem(KEY, JSON.stringify({ src: src, t: Date.now() }));
    } else {
      var saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && Date.now() - saved.t < DAYS * 864e5) src = clean(saved.src);
    }
  } catch (e) {}
  var tag = src || "direct";

  function linkId(a) {
    return (a.hostname.replace(/^www\./, "") + a.pathname).replace(/\/+$/, "").slice(0, 120);
  }

  function wire() {
    var links = document.querySelectorAll('a[href^="http"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.hostname === window.location.hostname) continue;
      if (/(^|\.)buy\.stripe\.com$/.test(a.hostname)) {
        try {
          var u = new URL(a.href);
          u.searchParams.set("client_reference_id", tag);
          a.href = u.toString();
        } catch (e) {}
      }
      a.addEventListener("click", function (ev) {
        if (!ENDPOINT || !navigator.sendBeacon) return;
        try {
          navigator.sendBeacon(ENDPOINT, JSON.stringify({ src: tag, link: linkId(ev.currentTarget), page: window.location.pathname }));
        } catch (e) {}
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
