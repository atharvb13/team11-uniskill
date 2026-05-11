/**
 * End-to-end encryption utilities for UniSkill chat.
 *
 * Protocol
 * --------
 *  Key generation  : ECDH P-256 (Web Crypto API — no external deps)
 *  Key derivation  : ECDH  →  AES-GCM-256 shared symmetric key
 *  Encryption      : AES-GCM with a random 96-bit IV per message
 *  Wire format     : "e2e:<iv_base64>:<ciphertext_base64>"
 *
 * Key storage
 * -----------
 *  Private key  →  localStorage (JWK).  NEVER sent to the server.
 *  Public key   →  server (base64-encoded SPKI), so conversation
 *                  partners can encrypt messages to you.
 *
 * Backward compatibility
 * ----------------------
 *  Messages that do NOT start with "e2e:" are treated as plain-text
 *  and rendered unchanged.
 */

// ─── localStorage keys ────────────────────────────────────────────────────────

const PRIV_JWK_KEY = "uniskill_e2e_priv_jwk";
const PUB_JWK_KEY  = "uniskill_e2e_pub_jwk";

/** Wire-format prefix that marks an E2E-encrypted message. */
export const E2E_PREFIX = "e2e:";

// ─── Key generation ───────────────────────────────────────────────────────────

/**
 * Generate a fresh ECDH P-256 key pair.
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,          // extractable — needed for localStorage export
    ["deriveKey"]
  );
}

// ─── localStorage persistence ─────────────────────────────────────────────────

async function keyToJwkString(key) {
  return JSON.stringify(await crypto.subtle.exportKey("jwk", key));
}

async function privateKeyFromJwk(str) {
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(str),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}

async function publicKeyFromJwk(str) {
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(str),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

/**
 * Persist a key pair to localStorage.
 * @param {CryptoKeyPair} keyPair
 */
export async function saveKeyPairToStorage(keyPair) {
  const [privJwk, pubJwk] = await Promise.all([
    keyToJwkString(keyPair.privateKey),
    keyToJwkString(keyPair.publicKey),
  ]);
  localStorage.setItem(PRIV_JWK_KEY, privJwk);
  localStorage.setItem(PUB_JWK_KEY, pubJwk);
}

/**
 * Load the key pair from localStorage.
 * @returns {Promise<CryptoKeyPair|null>}
 */
export async function loadKeyPairFromStorage() {
  const privJwk = localStorage.getItem(PRIV_JWK_KEY);
  const pubJwk  = localStorage.getItem(PUB_JWK_KEY);
  if (!privJwk || !pubJwk) return null;
  try {
    const [privateKey, publicKey] = await Promise.all([
      privateKeyFromJwk(privJwk),
      publicKeyFromJwk(pubJwk),
    ]);
    return { privateKey, publicKey };
  } catch {
    return null;
  }
}

/**
 * Load from localStorage, or generate + persist a new key pair.
 * @returns {Promise<{ keyPair: CryptoKeyPair, isNew: boolean }>}
 *   isNew — true when a fresh pair was generated (caller should upload public key).
 */
export async function getOrCreateKeyPair() {
  const existing = await loadKeyPairFromStorage();
  if (existing) return { keyPair: existing, isNew: false };

  const keyPair = await generateKeyPair();
  await saveKeyPairToStorage(keyPair);
  return { keyPair, isNew: true };
}

// ─── Public key SPKI ↔ base64 (server transport format) ─────────────────────

/**
 * Export a public CryptoKey to a base64-encoded SPKI string
 * suitable for storage on the server.
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>}
 */
export async function exportPublicKeyB64(publicKey) {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  let bin = "";
  for (const b of new Uint8Array(spki)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Import a base64-encoded SPKI string back into a CryptoKey.
 * @param {string} b64
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKeyB64(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey(
    "spki",
    buf.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

// ─── Shared-key derivation ────────────────────────────────────────────────────

/**
 * Derive a shared AES-GCM-256 key via ECDH.
 * Both sides (sender and recipient) arrive at the identical key
 * without ever transmitting it.
 *
 * @param {CryptoKey} myPrivateKey   — caller's ECDH private key
 * @param {CryptoKey} theirPublicKey — partner's ECDH public key
 * @returns {Promise<CryptoKey>}     — non-extractable AES-GCM key
 */
export async function deriveSharedKey(myPrivateKey, theirPublicKey) {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,               // AES key is non-extractable
    ["encrypt", "decrypt"]
  );
}

// ─── Encrypt / decrypt ────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with an AES-GCM shared key.
 *
 * @param {CryptoKey} sharedKey
 * @param {string}    plaintext
 * @returns {Promise<string>}  wire string: "e2e:<iv_b64>:<ct_b64>"
 */
export async function encryptMessage(sharedKey, plaintext) {
  const iv      = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(plaintext ?? "");

  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encoded
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ctBuf)));
  return `${E2E_PREFIX}${ivB64}:${ctB64}`;
}

/**
 * Returns true when the content string carries an E2E-encrypted payload.
 * @param {string|null|undefined} content
 */
export function isEncryptedContent(content) {
  return typeof content === "string" && content.startsWith(E2E_PREFIX);
}

/**
 * Decrypt a wire string produced by {@link encryptMessage}.
 *
 * @param {CryptoKey} sharedKey
 * @param {string}    wireStr   — "e2e:<iv_b64>:<ct_b64>"
 * @returns {Promise<string>}  plaintext
 * @throws if the format is invalid or decryption fails (wrong key / tampered data)
 */
export async function decryptMessage(sharedKey, wireStr) {
  const body     = wireStr.slice(E2E_PREFIX.length); // strip "e2e:"
  const colonIdx = body.indexOf(":");
  if (colonIdx === -1) throw new Error("Malformed E2E message (missing colon separator)");

  const ivB64 = body.slice(0, colonIdx);
  const ctB64 = body.slice(colonIdx + 1);

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    ct
  );
  return new TextDecoder().decode(plainBuf);
}
