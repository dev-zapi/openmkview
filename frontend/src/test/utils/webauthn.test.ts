import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  decodeBase64Url,
  encodeBase64Url,
  prepareCreationOptions,
  prepareRequestOptions,
  serializeRegistrationCredential,
  serializeAuthenticationCredential,
  ensureWebauthnSupport,
} from '../../utils/webauthn';

describe('webauthn utils', () => {
  describe('decodeBase64Url', () => {
    it('decodes base64url string to Uint8Array', () => {
      // "hello" in base64url = "aGVsbG8"
      const result = decodeBase64Url('aGVsbG8');
      expect(new TextDecoder().decode(result)).toBe('hello');
    });

    it('handles padding correctly', () => {
      // "a" in base64url = "YQ"
      const result = decodeBase64Url('YQ');
      expect(result[0]).toBe(97); // 'a'
    });

    it('handles URL-safe characters', () => {
      // Contains - and _ instead of + and /
      const result = decodeBase64Url('ab-_');
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe('encodeBase64Url', () => {
    it('encodes ArrayBuffer to base64url string', () => {
      const bytes = new TextEncoder().encode('hello');
      expect(encodeBase64Url(bytes)).toBe('aGVsbG8');
    });

    it('roundtrips with decodeBase64Url', () => {
      const original = 'test-data-1234';
      const encoded = encodeBase64Url(new TextEncoder().encode(original));
      const decoded = new TextDecoder().decode(decodeBase64Url(encoded));
      expect(decoded).toBe(original);
    });

    it('removes trailing padding', () => {
      const buffer = new TextEncoder().encode('a').buffer;
      const result = encodeBase64Url(buffer);
      expect(result).not.toContain('=');
    });
  });

  describe('prepareCreationOptions', () => {
    it('throws for invalid input', () => {
      expect(() => prepareCreationOptions(null)).toThrow('Invalid Passkey registration options');
      expect(() => prepareCreationOptions({})).toThrow('Invalid Passkey registration options');
      expect(() => prepareCreationOptions({ publicKey: 'not-object' })).toThrow();
    });

    it('decodes challenge and user.id from base64url strings', () => {
      const options = prepareCreationOptions({
        publicKey: {
          challenge: 'ZmFrZS1jaGFsbGVuZ2U',
          rp: { id: 'localhost', name: 'Test' },
          user: { id: 'ZmFrZS11c2VyLWlk', name: 'admin', displayName: 'admin' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      });

      expect(options.challenge).toBeInstanceOf(ArrayBuffer);
      expect(options.user.id).toBeInstanceOf(ArrayBuffer);
    });

    it('decodes excludeCredentials ids', () => {
      const options = prepareCreationOptions({
        publicKey: {
          challenge: 'ZmFrZQ',
          rp: { id: 'localhost', name: 'Test' },
          user: { id: 'ZmFrZQ', name: 'admin', displayName: 'admin' },
          pubKeyCredParams: [],
          excludeCredentials: [{ id: 'ZmFrZS1jcmVkLWlk', type: 'public-key' }],
        },
      });

      expect(options.excludeCredentials).toHaveLength(1);
      expect((options.excludeCredentials![0] as any).id).toBeInstanceOf(Uint8Array);
    });
  });

  describe('prepareRequestOptions', () => {
    it('throws for invalid input', () => {
      expect(() => prepareRequestOptions(null)).toThrow('Invalid Passkey authentication options');
      expect(() => prepareRequestOptions({})).toThrow();
    });

    it('decodes challenge and allowCredentials', () => {
      const options = prepareRequestOptions({
        publicKey: {
          challenge: 'ZmFrZQ',
          rpId: 'localhost',
          allowCredentials: [{ id: 'ZmFrZS1jcmVkLWlk', type: 'public-key' }],
        },
      });

      expect(options.publicKey!.challenge).toBeInstanceOf(ArrayBuffer);
      expect(options.publicKey!.allowCredentials).toHaveLength(1);
    });

    it('passes mediation option through', () => {
      const options = prepareRequestOptions({
        mediation: 'conditional',
        publicKey: {
          challenge: 'ZmFrZQ',
          rpId: 'localhost',
        },
      });

      expect((options as any).mediation).toBe('conditional');
    });
  });

  describe('serializeRegistrationCredential', () => {
    it('throws when credential is null', () => {
      expect(() => serializeRegistrationCredential(null)).toThrow('Passkey registration was cancelled');
    });

    it('serializes a registration credential', () => {
      const mockCredential = {
        id: 'test-id',
        rawId: new ArrayBuffer(4),
        type: 'public-key',
        response: {
          attestationObject: new ArrayBuffer(8),
          clientDataJSON: new ArrayBuffer(8),
          getTransports: () => ['internal'],
        },
        getClientExtensionResults: () => ({}),
      };

      const result = serializeRegistrationCredential(mockCredential as any);
      expect(result.id).toBe('test-id');
      expect(result.type).toBe('public-key');
      expect(typeof result.rawId).toBe('string');
      expect((result.response as any).transports).toEqual(['internal']);
    });
  });

  describe('serializeAuthenticationCredential', () => {
    it('throws when credential is null', () => {
      expect(() => serializeAuthenticationCredential(null)).toThrow('Passkey login was cancelled');
    });

    it('serializes an authentication credential', () => {
      const mockCredential = {
        id: 'test-id',
        rawId: new ArrayBuffer(4),
        type: 'public-key',
        response: {
          authenticatorData: new ArrayBuffer(8),
          clientDataJSON: new ArrayBuffer(8),
          signature: new ArrayBuffer(8),
          userHandle: new ArrayBuffer(4),
        },
        getClientExtensionResults: () => ({}),
      };

      const result = serializeAuthenticationCredential(mockCredential as any);
      expect(result.id).toBe('test-id');
      expect(typeof (result.response as any).signature).toBe('string');
      expect((result.response as any).userHandle).not.toBeNull();
    });

    it('handles null userHandle', () => {
      const mockCredential = {
        id: 'test-id',
        rawId: new ArrayBuffer(4),
        type: 'public-key',
        response: {
          authenticatorData: new ArrayBuffer(8),
          clientDataJSON: new ArrayBuffer(8),
          signature: new ArrayBuffer(8),
          userHandle: null,
        },
        getClientExtensionResults: () => ({}),
      };

      const result = serializeAuthenticationCredential(mockCredential as any);
      expect((result.response as any).userHandle).toBeNull();
    });
  });

  describe('ensureWebauthnSupport', () => {
    const originalPublicKeyCredential = window.PublicKeyCredential;
    const originalCredentials = navigator.credentials;

    afterEach(() => {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: originalPublicKeyCredential,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'credentials', {
        value: originalCredentials,
        writable: true,
        configurable: true,
      });
    });

    it('throws when PublicKeyCredential is not available', () => {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(() => ensureWebauthnSupport()).toThrow('Current browser does not support Passkey');
    });

    it('throws when navigator.credentials is not available', () => {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: class {},
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'credentials', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(() => ensureWebauthnSupport()).toThrow('Current browser does not support Passkey');
    });

    it('does not throw when both are available', () => {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: class {},
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'credentials', {
        value: { get: vi.fn(), create: vi.fn() },
        writable: true,
        configurable: true,
      });
      expect(() => ensureWebauthnSupport()).not.toThrow();
    });
  });
});
