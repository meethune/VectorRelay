// API Key Rotation Mechanism
// Provides secure API key generation, rotation, and revocation

import type { Env } from '../types';
import { logError } from './logger';

/**
 * API Key metadata stored in KV
 */
export interface APIKeyMetadata {
  keyId: string;
  hashedKey: string;
  name: string;
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
  permissions: string[];
  status: 'active' | 'deprecated' | 'revoked';
  rotationId?: string; // Links to the new key after rotation
}

/**
 * API Key creation result
 */
export interface APIKeyResult {
  keyId: string;
  apiKey: string; // Only returned on creation
  metadata: APIKeyMetadata;
}

/**
 * Generate a cryptographically secure random string
 *
 * @param length - Length of the string
 * @returns Random base64url string
 */
function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  // Convert to base64url (URL-safe base64)
  return btoa(String.fromCharCode.apply(null, [...array]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hash API key using SHA-256
 *
 * SECURITY: Never store API keys in plaintext.
 * Store only hashed versions for validation.
 *
 * @param apiKey - API key to hash
 * @returns Hex-encoded SHA-256 hash
 */
async function hashAPIKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generate a new API key
 *
 * @param env - Cloudflare environment
 * @param options - Key creation options
 * @returns API key and metadata
 *
 * @example
 * const result = await generateAPIKey(env, {
 *   name: 'Production API',
 *   permissions: ['read:threats', 'write:threats'],
 *   expiresInDays: 365,
 * });
 * console.log('Save this key:', result.apiKey);
 */
export async function generateAPIKey(
  env: Env,
  options: {
    name: string;
    permissions?: string[];
    expiresInDays?: number;
  }
): Promise<APIKeyResult> {
  const { name, permissions = ['read:*'], expiresInDays } = options;

  // Generate unique key ID and API key
  const keyId = `key_${generateSecureToken(16)}`;
  const apiKey = `vr_${generateSecureToken(48)}`; // VectorRelay prefix

  // Hash the API key for storage
  const hashedKey = await hashAPIKey(apiKey);

  // Calculate expiration
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = expiresInDays
    ? now + (expiresInDays * 24 * 60 * 60)
    : null;

  // Create metadata
  const metadata: APIKeyMetadata = {
    keyId,
    hashedKey,
    name,
    createdAt: now,
    expiresAt,
    lastUsedAt: null,
    permissions,
    status: 'active',
  };

  try {
    // Store metadata in KV
    await env.CACHE.put(
      `apikey:metadata:${keyId}`,
      JSON.stringify(metadata),
      expiresAt ? { expirationTtl: expiresAt - now } : undefined
    );

    // Store hash → keyId mapping for validation
    await env.CACHE.put(
      `apikey:hash:${hashedKey}`,
      keyId,
      expiresAt ? { expirationTtl: expiresAt - now } : undefined
    );

    console.log(`API key created: ${keyId} (${name})`);

    return {
      keyId,
      apiKey, // ⚠️ Only returned once - must be saved immediately
      metadata,
    };
  } catch (error) {
    logError('Failed to create API key', error, { keyId, name });
    throw new Error('Failed to create API key');
  }
}

/**
 * Validate API key and check permissions
 *
 * @param env - Cloudflare environment
 * @param apiKey - API key to validate
 * @param requiredPermission - Optional permission to check
 * @returns Metadata if valid, null otherwise
 *
 * @example
 * const metadata = await validateAPIKey(env, request.headers.get('Authorization')?.slice(7));
 * if (!metadata) {
 *   return new Response('Unauthorized', { status: 401 });
 * }
 */
export async function validateAPIKey(
  env: Env,
  apiKey: string | null,
  requiredPermission?: string
): Promise<APIKeyMetadata | null> {
  if (!apiKey || !apiKey.startsWith('vr_')) {
    return null;
  }

  try {
    // Hash the provided key
    const hashedKey = await hashAPIKey(apiKey);

    // Look up key ID by hash
    const keyId = await env.CACHE.get(`apikey:hash:${hashedKey}`);
    if (!keyId) {
      return null;
    }

    // Retrieve metadata
    const metadataStr = await env.CACHE.get(`apikey:metadata:${keyId}`);
    if (!metadataStr) {
      return null;
    }

    const metadata: APIKeyMetadata = JSON.parse(metadataStr);

    // Check status
    if (metadata.status !== 'active') {
      console.log(`API key ${keyId} is ${metadata.status}`);
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (metadata.expiresAt && metadata.expiresAt < now) {
      console.log(`API key ${keyId} expired at ${new Date(metadata.expiresAt * 1000).toISOString()}`);
      return null;
    }

    // Check permissions if required
    if (requiredPermission) {
      const hasPermission = metadata.permissions.some(perm => {
        // Wildcard permission (read:*, write:*, etc.)
        if (perm.endsWith(':*')) {
          const prefix = perm.slice(0, -1); // Remove '*'
          return requiredPermission.startsWith(prefix);
        }
        // Exact match
        return perm === requiredPermission;
      });

      if (!hasPermission) {
        console.log(`API key ${keyId} lacks permission: ${requiredPermission}`);
        return null;
      }
    }

    // Update last used timestamp (async, don't block)
    metadata.lastUsedAt = now;
    env.CACHE.put(`apikey:metadata:${keyId}`, JSON.stringify(metadata))
      .catch(err => console.error('Failed to update lastUsedAt:', err));

    return metadata;
  } catch (error) {
    logError('Failed to validate API key', error);
    return null;
  }
}

/**
 * Rotate an API key (create new, deprecate old)
 *
 * SECURITY: Key rotation best practice:
 * 1. Generate new key
 * 2. Mark old key as 'deprecated' (still works, but warns)
 * 3. After grace period, revoke old key
 *
 * @param env - Cloudflare environment
 * @param oldKeyId - Existing key ID to rotate
 * @param gracePeriodDays - Days before old key is revoked
 * @returns New API key and metadata
 *
 * @example
 * const result = await rotateAPIKey(env, 'key_abc123', 30);
 * console.log('New API key:', result.apiKey);
 * console.log('Old key will be revoked in 30 days');
 */
export async function rotateAPIKey(
  env: Env,
  oldKeyId: string,
  gracePeriodDays: number = 30
): Promise<APIKeyResult> {
  try {
    // Retrieve old key metadata
    const oldMetadataStr = await env.CACHE.get(`apikey:metadata:${oldKeyId}`);
    if (!oldMetadataStr) {
      throw new Error('API key not found');
    }

    const oldMetadata: APIKeyMetadata = JSON.parse(oldMetadataStr);

    // Generate new key with same permissions
    const newKeyResult = await generateAPIKey(env, {
      name: `${oldMetadata.name} (rotated)`,
      permissions: oldMetadata.permissions,
      expiresInDays: oldMetadata.expiresAt
        ? Math.ceil((oldMetadata.expiresAt - Math.floor(Date.now() / 1000)) / 86400)
        : undefined,
    });

    // Mark old key as deprecated
    oldMetadata.status = 'deprecated';
    oldMetadata.rotationId = newKeyResult.keyId;

    const now = Math.floor(Date.now() / 1000);
    const revokeAt = now + (gracePeriodDays * 24 * 60 * 60);

    // Update old key metadata with new expiration
    await env.CACHE.put(
      `apikey:metadata:${oldKeyId}`,
      JSON.stringify(oldMetadata),
      { expirationTtl: revokeAt - now }
    );

    // Schedule automatic revocation after grace period
    // (KV TTL will automatically delete the key)

    console.log(`API key rotated: ${oldKeyId} → ${newKeyResult.keyId} (grace period: ${gracePeriodDays} days)`);

    return newKeyResult;
  } catch (error) {
    logError('Failed to rotate API key', error, { oldKeyId });
    throw new Error('Failed to rotate API key');
  }
}

/**
 * Revoke an API key immediately
 *
 * @param env - Cloudflare environment
 * @param keyId - Key ID to revoke
 * @returns Success boolean
 *
 * @example
 * await revokeAPIKey(env, 'key_abc123');
 */
export async function revokeAPIKey(
  env: Env,
  keyId: string
): Promise<boolean> {
  try {
    // Retrieve metadata
    const metadataStr = await env.CACHE.get(`apikey:metadata:${keyId}`);
    if (!metadataStr) {
      return false;
    }

    const metadata: APIKeyMetadata = JSON.parse(metadataStr);

    // Mark as revoked
    metadata.status = 'revoked';

    // Update metadata (but don't delete - keep audit trail)
    await env.CACHE.put(
      `apikey:metadata:${keyId}`,
      JSON.stringify(metadata),
      { expirationTtl: 86400 * 30 } // Keep for 30 days for audit
    );

    // Delete hash mapping (prevents validation)
    await env.CACHE.delete(`apikey:hash:${metadata.hashedKey}`);

    console.log(`API key revoked: ${keyId}`);
    return true;
  } catch (error) {
    logError('Failed to revoke API key', error, { keyId });
    return false;
  }
}

/**
 * List all API keys (for management dashboard)
 *
 * @param env - Cloudflare environment
 * @returns Array of key metadata
 *
 * @example
 * const keys = await listAPIKeys(env);
 * for (const key of keys) {
 *   console.log(`${key.keyId}: ${key.name} (${key.status})`);
 * }
 */
export async function listAPIKeys(
  env: Env
): Promise<APIKeyMetadata[]> {
  try {
    // List all keys with apikey:metadata: prefix
    const list = await env.CACHE.list({ prefix: 'apikey:metadata:' });

    const keys: APIKeyMetadata[] = [];

    for (const key of list.keys) {
      const metadataStr = await env.CACHE.get(key.name);
      if (metadataStr) {
        const metadata: APIKeyMetadata = JSON.parse(metadataStr);
        keys.push(metadata);
      }
    }

    // Sort by creation date (newest first)
    keys.sort((a, b) => b.createdAt - a.createdAt);

    return keys;
  } catch (error) {
    logError('Failed to list API keys', error);
    return [];
  }
}

/**
 * Get API key metadata by ID
 *
 * @param env - Cloudflare environment
 * @param keyId - Key ID
 * @returns Metadata or null
 */
export async function getAPIKeyMetadata(
  env: Env,
  keyId: string
): Promise<APIKeyMetadata | null> {
  try {
    const metadataStr = await env.CACHE.get(`apikey:metadata:${keyId}`);
    if (!metadataStr) {
      return null;
    }

    return JSON.parse(metadataStr);
  } catch (error) {
    logError('Failed to get API key metadata', error, { keyId });
    return null;
  }
}

/**
 * Update API key permissions
 *
 * @param env - Cloudflare environment
 * @param keyId - Key ID
 * @param permissions - New permissions array
 * @returns Success boolean
 */
export async function updateAPIKeyPermissions(
  env: Env,
  keyId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    const metadataStr = await env.CACHE.get(`apikey:metadata:${keyId}`);
    if (!metadataStr) {
      return false;
    }

    const metadata: APIKeyMetadata = JSON.parse(metadataStr);
    metadata.permissions = permissions;

    // Calculate remaining TTL if key expires
    const now = Math.floor(Date.now() / 1000);
    const ttl = metadata.expiresAt ? metadata.expiresAt - now : undefined;

    await env.CACHE.put(
      `apikey:metadata:${keyId}`,
      JSON.stringify(metadata),
      ttl ? { expirationTtl: ttl } : undefined
    );

    console.log(`API key permissions updated: ${keyId}`);
    return true;
  } catch (error) {
    logError('Failed to update API key permissions', error, { keyId });
    return false;
  }
}
