import { apiClient } from './client';

export interface AuthFileTemplateField {
  key: string;
  required: boolean;
  example: unknown;
  /** English fallback; the panel prefers its own translation keyed by `key`. */
  description: string;
}

export interface AuthFileTemplateProvider {
  provider: string;
  label: string;
  fileName: string;
}

export interface AuthFileTemplate extends AuthFileTemplateProvider {
  /** Required keys with placeholder values, exactly what a minimal upload needs. */
  template: Record<string, unknown>;
  /** Optional keys with neutral example values. */
  optional: Record<string, unknown>;
  fields: AuthFileTemplateField[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function normalizeAuthFileTemplateProviders(payload: unknown): AuthFileTemplateProvider[] {
  const list = isRecord(payload) && Array.isArray(payload.providers) ? payload.providers : [];
  return list.flatMap((item) => {
    if (!isRecord(item)) return [];
    const provider = readString(item.provider);
    if (!provider) return [];
    return [{ provider, label: readString(item.label) || provider, fileName: readString(item.file_name) }];
  });
}

export function normalizeAuthFileTemplate(payload: unknown): AuthFileTemplate | undefined {
  if (!isRecord(payload)) return undefined;
  const provider = readString(payload.provider);
  if (!provider || !isRecord(payload.template)) return undefined;
  const fields = Array.isArray(payload.fields)
    ? payload.fields.flatMap((item) => {
        if (!isRecord(item)) return [];
        const key = readString(item.key);
        if (!key) return [];
        return [
          {
            key,
            required: item.required === true,
            example: item.example,
            description: readString(item.description),
          },
        ];
      })
    : [];
  return {
    provider,
    label: readString(payload.label) || provider,
    fileName: readString(payload.file_name),
    template: { ...payload.template },
    optional: isRecord(payload.optional) ? { ...payload.optional } : {},
    fields,
  };
}

/** Builds the JSON text the operator edits: required keys first, optional keys appended on request. */
export function buildAuthFileTemplateText(
  template: AuthFileTemplate,
  includeOptional: boolean
): string {
  const value = includeOptional
    ? { ...template.template, ...template.optional }
    : { ...template.template };
  return JSON.stringify(value, null, 2) + '\n';
}

export const authFileTemplateApi = {
  listProviders: async (): Promise<AuthFileTemplateProvider[]> =>
    normalizeAuthFileTemplateProviders(await apiClient.get<unknown>('/auth-files/template')),
  get: async (provider: string): Promise<AuthFileTemplate | undefined> =>
    normalizeAuthFileTemplate(
      await apiClient.get<unknown>('/auth-files/template', { params: { provider } })
    ),
};
