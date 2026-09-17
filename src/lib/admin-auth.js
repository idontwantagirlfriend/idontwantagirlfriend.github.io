// Admin gate: the bundle only ever ships a SHA-256 digest of
// "<username>:<password>" (VITE_SHA256_PASSWORD), never the plaintext.
const PASSWORD_SHA256 = import.meta.env.VITE_SHA256_PASSWORD || "";
const SESSION_KEY = "blog-admin-session";

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (value) => {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
};

// Session token is a second-round hash, so the value persisted in
// sessionStorage differs from the digest shipped in the bundle.
// Resolved once at startup, then isLoggedIn() stays synchronous.
let expectedSessionToken = null;
const ready = PASSWORD_SHA256
  ? sha256Hex(`${PASSWORD_SHA256}:session`).then((token) => { expectedSessionToken = token; })
  : Promise.resolve();

export const adminAuth = {
  isConfigured: Boolean(PASSWORD_SHA256),
  ready,
  isLoggedIn: () => Boolean(expectedSessionToken) && window.sessionStorage.getItem(SESSION_KEY) === expectedSessionToken,
  async login(username, password) {
    if (!this.isConfigured) return false;
    const digest = await sha256Hex(`${username}:${password}`);
    if (digest !== PASSWORD_SHA256) return false;
    window.sessionStorage.setItem(SESSION_KEY, await sha256Hex(`${digest}:session`));
    return true;
  },
  logout: () => window.sessionStorage.removeItem(SESSION_KEY),
};
