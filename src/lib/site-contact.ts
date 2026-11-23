const configuredContactEmail = import.meta.env.PUBLIC_CONTACT_EMAIL?.trim() || 'recall-radar@jtheasset.com';

export const publicContactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredContactEmail)
  ? configuredContactEmail
  : undefined;
