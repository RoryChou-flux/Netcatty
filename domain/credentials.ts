import type { SyncPayload } from "./sync";

export const CREDENTIAL_ENCRYPTION_PREFIX = "enc:v1:";

/**
 * Base64 pattern: only allows A-Z, a-z, 0-9, +, / and trailing = padding.
 * safeStorage ciphertext is always non-empty base64, so we require at least
 * one character after the prefix to avoid matching the bare prefix itself.
 */
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

export const isEncryptedCredentialPlaceholder = (
  value: string | undefined | null,
): value is string => {
  if (typeof value !== "string" || !value.startsWith(CREDENTIAL_ENCRYPTION_PREFIX)) {
    return false;
  }
  const payload = value.slice(CREDENTIAL_ENCRYPTION_PREFIX.length);
  return payload.length > 0 && BASE64_RE.test(payload);
};

/**
 * Strip enc:v1: placeholders from a single credential value.
 * Used at the terminal connection boundary to avoid sending encrypted
 * placeholders as actual passwords to SSH/Telnet servers.
 */
export const sanitizeCredentialValue = (
  value: string | undefined,
): string | undefined => {
  if (isEncryptedCredentialPlaceholder(value)) return undefined;
  return value;
};

/**
 * Scan a sync payload for any fields that still carry device-bound
 * enc:v1: ciphertext.  Returns the dotted paths of offending fields.
 * Used as a pre-upload guard to prevent pushing un-decryptable data.
 */
export const findSyncPayloadEncryptedCredentialPaths = (
  payload: SyncPayload,
): string[] => {
  const issues: string[] = [];

  payload.hosts.forEach((host, index) => {
    if (isEncryptedCredentialPlaceholder(host.password)) {
      issues.push(`hosts[${index}].password`);
    }
    if (isEncryptedCredentialPlaceholder(host.telnetPassword)) {
      issues.push(`hosts[${index}].telnetPassword`);
    }
    if (isEncryptedCredentialPlaceholder(host.proxyConfig?.password)) {
      issues.push(`hosts[${index}].proxyConfig.password`);
    }
  });

  payload.keys.forEach((key, index) => {
    if (isEncryptedCredentialPlaceholder(key.privateKey)) {
      issues.push(`keys[${index}].privateKey`);
    }
    if (isEncryptedCredentialPlaceholder(key.passphrase)) {
      issues.push(`keys[${index}].passphrase`);
    }
  });

  payload.identities?.forEach((identity, index) => {
    if (isEncryptedCredentialPlaceholder(identity.password)) {
      issues.push(`identities[${index}].password`);
    }
  });

  return issues;
};
