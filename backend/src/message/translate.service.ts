import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class TranslateService {
  private readonly baseUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:5009';

  // Language name to code mapping based on LibreTranslate /languages endpoint
  private readonly languageMap: Record<string, string> = {
    'english': 'en',
    'albanian': 'sq',
    'arabic': 'ar',
    'azerbaijani': 'az',
    'basque': 'eu',
    'bengali': 'bn',
    'bulgarian': 'bg',
    'catalan': 'ca',
    'chinese': 'zh-Hans',
    'chinese (traditional)': 'zh-Hant',
    'czech': 'cs',
    'danish': 'da',
    'dutch': 'nl',
    'esperanto': 'eo',
    'estonian': 'et',
    'finnish': 'fi',
    'french': 'fr',
    'galician': 'gl',
    'german': 'de',
    'greek': 'el',
    'hebrew': 'he',
    'hindi': 'hi',
    'hungarian': 'hu',
    'indonesian': 'id',
    'irish': 'ga',
    'italian': 'it',
    'japanese': 'ja',
    'korean': 'ko',
    'kyrgyz': 'ky',
    'latvian': 'lv',
    'lithuanian': 'lt',
    'malay': 'ms',
    'norwegian': 'nb',
    'persian': 'fa',
    'polish': 'pl',
    'portuguese': 'pt',
    'portuguese (brazil)': 'pt-BR',
    'romanian': 'ro',
    'russian': 'ru',
    'slovak': 'sk',
    'slovenian': 'sl',
    'spanish': 'es',
    'swedish': 'sv',
    'tagalog': 'tl',
    'thai': 'th',
    'turkish': 'tr',
    'ukrainian': 'uk',
    'urdu': 'ur',
    'vietnamese': 'vi',
  };

  /**
   * Get list of supported languages
   */
  getSupportedLanguages(): string[] {
    return Object.keys(this.languageMap).map(
      (name) => name.charAt(0).toUpperCase() + name.slice(1)
    );
  }

  /**
   * Convert language name to LibreTranslate code
   */
  private getLanguageCode(languageName: string): string | null {
    return this.languageMap[languageName.toLowerCase()] || null;
  }

  /**
   * Translate text using LibreTranslate API
   */
  async translateText(
    text: string,
    targetLanguage: string,
  ): Promise<{ translatedText: string }> {
    const targetCode = this.getLanguageCode(targetLanguage);

    if (!targetCode) {
      throw new InternalServerErrorException(
        `Unsupported language: ${targetLanguage}`,
      );
    }

    try {
      const response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: 'auto',
          target: targetCode,
          api_key: '',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('LibreTranslate API error:', error);
        throw new InternalServerErrorException('Translation failed');
      }

      const data = await response.json();

      return {
        translatedText: data.translatedText,
      };
    } catch (error) {
      console.error('Translation error:', error);
      throw new InternalServerErrorException('Failed to translate text');
    }
  }
}
