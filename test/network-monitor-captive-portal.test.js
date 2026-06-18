const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCaptivePortalSnapshot,
  sanitizePortalUrl
} = require("../dist/worker/network-monitor");

test("Fortinet portal host is detected regardless of dynamic port", () => {
  const redirectedTo = sanitizePortalUrl("http://authupm.upm.edu.my:8090/fgtauth/opaque-session-token?magic=secret&4Tredir=https%3A%2F%2Fexample.test%2F");
  const snapshot = buildCaptivePortalSnapshot({
    probeUrl: "https://www.gstatic.com/generate_204",
    redirectedTo,
    status: 302,
    contentType: "text/html",
    sample: ""
  });

  assert.ok(snapshot);
  assert.equal(snapshot.state, "detected");
  assert.equal(snapshot.confidence, "high");
  assert.equal(snapshot.portalHost, "authupm.upm.edu.my");
  assert.equal(snapshot.portalUrl, "http://authupm.upm.edu.my:8090/");
  assert.equal(snapshot.redirectedTo, "http://authupm.upm.edu.my:8090/");
  assert.match(snapshot.evidence.join("\n"), /Fortinet captive portal detected: authupm\.upm\.edu\.my/);
});

test("Fortinet portal markers are detected without storing tokenized paths or queries", () => {
  const snapshot = buildCaptivePortalSnapshot({
    probeUrl: "https://www.cloudflare.com/cdn-cgi/trace",
    redirectedTo: sanitizePortalUrl("https://authupm.upm.edu.my:8443/path/session-token?token=secret"),
    status: 200,
    contentType: "text/html; charset=utf-8",
    sample: `
      <html>
        <head><title>Firewall Authentication</title></head>
        <body>
          <h1>Authentication Required</h1>
          <p>Please enter your username and password to continue.</p>
          <p>PLEASE DO NOT CLOSE THIS PAGE AFTER SIGN IN.</p>
          <form action="/" method="post">
            <input id="ft_un" name="username">
            <input id="ft_pd" name="password" type="password">
            <input type="hidden" name="magic" value="redacted">
            <input type="hidden" name="4Tredir" value="redacted">
            <button>Continue</button>
          </form>
        </body>
      </html>
    `
  });

  assert.ok(snapshot);
  assert.equal(snapshot.state, "detected");
  assert.equal(snapshot.confidence, "high");
  assert.equal(snapshot.portalHost, "authupm.upm.edu.my");
  assert.equal(snapshot.portalUrl, "https://authupm.upm.edu.my:8443/");
  assert.doesNotMatch(snapshot.portalUrl, /session-token|token=secret/);
  assert.match(snapshot.evidence.join("\n"), /Fortinet captive portal page markers detected/);
  assert.equal(snapshot.sanitizedTitle, "Firewall Authentication");
});
