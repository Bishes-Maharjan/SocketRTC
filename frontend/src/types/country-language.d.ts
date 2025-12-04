// country-language.d.ts
declare module "country-language" {
  export interface Country {
    code_2: string;
    code_3: string;
    numCode: string;
    name: string;
  }

  export interface Language {
    iso639_1: string;
    iso639_2: string;
    iso639_2en: string;
    iso639_3: string;
    name: string[];
    nativeName: string[];
    direction: string;
    family: string;
    countries: Country[];
  }

  export function getLanguage(code: string): Language | undefined;
  export function getCountry(code: string): any;
  export function getLanguages(code: string): any;
  export function getCountries(code: string): any;
}
