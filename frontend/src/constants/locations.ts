// /constants/locations.ts
import { countries } from "countries-list";
import countryLanguage from "country-language";
import ISO6391 from "iso-639-1";

export const LANGUAGES = ISO6391.getAllNames().sort();

export const LANGUAGE_TO_FLAG: { [key: string]: string } = {};

ISO6391.getAllCodes().forEach((code) => {
  const languageName = ISO6391.getName(code);

  if (languageName) {
    // Get countries where this language is spoken
    const languageCountries = countryLanguage.getLanguage(code);

    if (
      languageCountries &&
      languageCountries.countries &&
      languageCountries.countries.length > 0
    ) {
      // Use the first country code
      LANGUAGE_TO_FLAG[languageName.toLowerCase()] =
        languageCountries.countries[0].code_2.toLowerCase();
    }
  }
});

export const COUNTRIES = Object.entries(countries)
  .map(([, country]) => country.name)
  .sort();
