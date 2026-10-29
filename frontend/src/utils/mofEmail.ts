export const MOF_EMAIL_DOMAIN = 'mof.gov.ae';

export const normalizeMofEmail = (email: string): string => email.trim().toLowerCase();

export const isMofEmail = (email: string): boolean => {
  const normalizedEmail = normalizeMofEmail(email);
  const atIndex = normalizedEmail.lastIndexOf('@');

  return (
    atIndex > 0
    && atIndex === normalizedEmail.indexOf('@')
    && normalizedEmail.slice(atIndex + 1) === MOF_EMAIL_DOMAIN
    && !/\s/.test(normalizedEmail)
  );
};

export const MOF_EMAIL_ERROR = `Please use your Ministry of Finance email address ending in @${MOF_EMAIL_DOMAIN}.`;
