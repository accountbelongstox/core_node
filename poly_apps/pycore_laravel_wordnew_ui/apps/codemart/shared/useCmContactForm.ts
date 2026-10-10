import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmPublicApi } from '../api/CmPublicApi';
import { CM_EMAIL_PATTERN } from './useCmRegister';

export interface CmContactDraft {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type CmContactField = keyof CmContactDraft;

export const CM_CONTACT_MESSAGE_MAX = 5000;
export const CM_CONTACT_NAME_MAX = 100;
export const CM_CONTACT_SUBJECT_MAX = 255;
const CONTACT_MESSAGE_MIN = 5;
const HTTP_TOO_MANY_REQUESTS = 429;
const EMPTY_CONTACT: CmContactDraft = { name: '', email: '', subject: '', message: '' };

function validateContact(draft: CmContactDraft): Partial<Record<CmContactField, string>> {
  const errors: Partial<Record<CmContactField, string>> = {};
  if (!draft.name.trim()) errors.name = 'infoPages.contactForm.errors.nameRequired';
  else if (draft.name.trim().length > CM_CONTACT_NAME_MAX) errors.name = 'infoPages.contactForm.errors.nameTooLong';
  if (!CM_EMAIL_PATTERN.test(draft.email.trim())) errors.email = 'infoPages.contactForm.errors.emailInvalid';
  if (draft.subject.trim().length > CM_CONTACT_SUBJECT_MAX) errors.subject = 'infoPages.contactForm.errors.subjectTooLong';
  const messageLength = draft.message.trim().length;
  if (messageLength < CONTACT_MESSAGE_MIN) errors.message = 'infoPages.contactForm.errors.messageTooShort';
  else if (messageLength > CM_CONTACT_MESSAGE_MAX) errors.message = 'infoPages.contactForm.errors.messageTooLong';
  return errors;
}

export interface CmContactFormModel {
  draft: CmContactDraft;
  update: (field: CmContactField, value: string) => void;
  /** Translation keys of the field errors. */
  fieldErrors: Partial<Record<CmContactField, string>>;
  pending: boolean;
  sent: boolean;
  error: string | null;
  sendAnother: () => void;
  submit: () => Promise<void>;
}

/** Public contact form shared by the web and mobile information screens. */
export function useCmContactForm(): CmContactFormModel {
  const { t } = useTranslation('cm');
  const [draft, setDraft] = useState<CmContactDraft>(EMPTY_CONTACT);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CmContactField, string>>>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((field: CmContactField, value: string): void => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    const errors = validateContact(draft);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    const response = await cmPublicApi.submitContact({
      name: draft.name.trim(),
      email: draft.email.trim(),
      subject: draft.subject.trim() || undefined,
      message: draft.message.trim(),
    });
    setPending(false);
    if (response.success) {
      setSent(true);
      setDraft(EMPTY_CONTACT);
      return;
    }
    setError(response.status === HTTP_TOO_MANY_REQUESTS
      ? t('infoPages.contactForm.throttled')
      : cmErrorMessage(t, response, 'infoPages.contactForm.failed'));
  }, [draft, t]);

  const sendAnother = useCallback((): void => setSent(false), []);

  return { draft, update, fieldErrors, pending, sent, error, sendAnother, submit };
}
