const configuredContactEmail = import.meta.env.PUBLIC_CONTACT_EMAIL?.trim() ?? '';

export const publicContactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredContactEmail)
  ? configuredContactEmail
  : undefined;
