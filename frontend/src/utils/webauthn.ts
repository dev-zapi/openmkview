type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function encodeBase64Url(value: ArrayBuffer | ArrayBufferView): string {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function mapCredentialDescriptor(value: unknown): unknown {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return value;
  }

  return {
    ...value,
    id: decodeBase64Url(value.id),
  };
}

export function prepareCreationOptions(input: unknown): PublicKeyCredentialCreationOptions {
  if (!isRecord(input) || !isRecord(input.publicKey)) {
    throw new Error('Invalid Passkey registration options');
  }

  const publicKey = input.publicKey;

  return {
    ...(publicKey as unknown as PublicKeyCredentialCreationOptions),
    challenge:
      typeof publicKey.challenge === 'string'
        ? asArrayBuffer(decodeBase64Url(publicKey.challenge))
        : (publicKey.challenge as BufferSource),
    user: isRecord(publicKey.user)
      ? {
          ...(publicKey.user as unknown as PublicKeyCredentialUserEntity),
          id:
            typeof publicKey.user.id === 'string'
              ? asArrayBuffer(decodeBase64Url(publicKey.user.id))
              : (publicKey.user.id as BufferSource),
        }
      : (publicKey.user as unknown as PublicKeyCredentialUserEntity),
    excludeCredentials: Array.isArray(publicKey.excludeCredentials)
      ? publicKey.excludeCredentials.map(mapCredentialDescriptor) as PublicKeyCredentialDescriptor[]
      : undefined,
  };
}

export function prepareRequestOptions(input: unknown): CredentialRequestOptions {
  if (!isRecord(input) || !isRecord(input.publicKey)) {
    throw new Error('Invalid Passkey authentication options');
  }

  const publicKey = input.publicKey;

  return {
    ...(typeof input.mediation === 'string' ? { mediation: input.mediation as CredentialMediationRequirement } : {}),
    publicKey: {
      ...(publicKey as unknown as PublicKeyCredentialRequestOptions),
      challenge:
        typeof publicKey.challenge === 'string'
          ? asArrayBuffer(decodeBase64Url(publicKey.challenge))
          : (publicKey.challenge as BufferSource),
      allowCredentials: Array.isArray(publicKey.allowCredentials)
        ? publicKey.allowCredentials.map(mapCredentialDescriptor) as PublicKeyCredentialDescriptor[]
        : undefined,
    },
  };
}

export function serializeRegistrationCredential(
  credential: Credential | null,
): RecordLike {
  const publicKeyCredential = credential as PublicKeyCredential | null;
  if (!publicKeyCredential) {
    throw new Error('Passkey registration was cancelled');
  }

  const response = publicKeyCredential.response as AuthenticatorAttestationResponse;
  const transports = typeof response.getTransports === 'function' ? response.getTransports() : undefined;

  return {
    id: publicKeyCredential.id,
    rawId: encodeBase64Url(publicKeyCredential.rawId),
    type: publicKeyCredential.type,
    response: {
      attestationObject: encodeBase64Url(response.attestationObject),
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      transports,
    },
    extensions: publicKeyCredential.getClientExtensionResults(),
  };
}

export function serializeAuthenticationCredential(
  credential: Credential | null,
): RecordLike {
  const publicKeyCredential = credential as PublicKeyCredential | null;
  if (!publicKeyCredential) {
    throw new Error('Passkey login was cancelled');
  }

  const response = publicKeyCredential.response as AuthenticatorAssertionResponse;

  return {
    id: publicKeyCredential.id,
    rawId: encodeBase64Url(publicKeyCredential.rawId),
    type: publicKeyCredential.type,
    response: {
      authenticatorData: encodeBase64Url(response.authenticatorData),
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      signature: encodeBase64Url(response.signature),
      userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
    },
    extensions: publicKeyCredential.getClientExtensionResults(),
  };
}

export function ensureWebauthnSupport(): void {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error('Current browser does not support Passkey');
  }
}
