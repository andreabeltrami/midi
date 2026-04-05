import { Injectable, signal } from '@angular/core';

export type SupportedLanguage = 'it' | 'en';

type TranslationValue = string | TranslationMap;
interface TranslationMap {
  [key: string]: TranslationValue;
}

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly storageKey = 'midi-preferred-language';

  readonly language = signal<SupportedLanguage>('en');
  readonly translations = signal<TranslationMap>({});

  constructor() {
    void this.useLanguage(this.getInitialLanguage());
  }

  async useLanguage(language: SupportedLanguage): Promise<void> {
    const normalizedLanguage = language === 'it' ? 'it' : 'en';

    try {
      const response = await fetch(`i18n/${normalizedLanguage}.json`);
      if (!response.ok) {
        throw new Error(`Unable to load translations for ${normalizedLanguage}`);
      }

      const data = (await response.json()) as TranslationMap;
      this.language.set(normalizedLanguage);
      this.translations.set(data);
      localStorage.setItem(this.storageKey, normalizedLanguage);
      document.documentElement.lang = normalizedLanguage;
    } catch (error) {
      console.error(error);
    }
  }

  t(key: string, params?: Record<string, string | number>): string {
    const rawValue = this.resolveKey(key, this.translations());
    const template = typeof rawValue === 'string' ? rawValue : key;

    if (!params) {
      return template;
    }

    return Object.entries(params).reduce((message, [paramKey, paramValue]) => {
      return message.replaceAll(`{${paramKey}}`, String(paramValue));
    }, template);
  }

  getLocale(): string {
    return this.language() === 'it' ? 'it-IT' : 'en-US';
  }

  private getInitialLanguage(): SupportedLanguage {
    const savedLanguage = localStorage.getItem(this.storageKey);
    if (savedLanguage === 'it' || savedLanguage === 'en') {
      return savedLanguage;
    }

    return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
  }

  private resolveKey(key: string, dictionary: TranslationMap): TranslationValue | undefined {
    return key.split('.').reduce<TranslationValue | undefined>((currentValue, pathPart) => {
      if (!currentValue || typeof currentValue === 'string') {
        return undefined;
      }

      return currentValue[pathPart];
    }, dictionary);
  }
}
