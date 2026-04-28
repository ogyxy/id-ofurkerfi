export interface PhoneCountry {
  code: string; // e.g. "+354"
  name: string; // Icelandic display name
  flag: string;
}

export const COMMON_PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "+354", name: "Ísland", flag: "🇮🇸" },
  { code: "+47", name: "Noregur", flag: "🇳🇴" },
  { code: "+46", name: "Svíþjóð", flag: "🇸🇪" },
  { code: "+45", name: "Danmörk", flag: "🇩🇰" },
  { code: "+358", name: "Finnland", flag: "🇫🇮" },
  { code: "+372", name: "Eistland", flag: "🇪🇪" },
  { code: "+44", name: "Bretland", flag: "🇬🇧" },
  { code: "+49", name: "Þýskaland", flag: "🇩🇪" },
  { code: "+1", name: "Bandaríkin", flag: "🇺🇸" },
];

// Alphabetical full list (Icelandic names)
export const ALL_PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "+93", name: "Afganistan", flag: "🇦🇫" },
  { code: "+355", name: "Albanía", flag: "🇦🇱" },
  { code: "+213", name: "Alsír", flag: "🇩🇿" },
  { code: "+376", name: "Andorra", flag: "🇦🇩" },
  { code: "+244", name: "Angóla", flag: "🇦🇴" },
  { code: "+54", name: "Argentína", flag: "🇦🇷" },
  { code: "+374", name: "Armenía", flag: "🇦🇲" },
  { code: "+61", name: "Ástralía", flag: "🇦🇺" },
  { code: "+43", name: "Austurríki", flag: "🇦🇹" },
  { code: "+994", name: "Aserbaídsjan", flag: "🇦🇿" },
  { code: "+1", name: "Bandaríkin", flag: "🇺🇸" },
  { code: "+880", name: "Bangladess", flag: "🇧🇩" },
  { code: "+375", name: "Hvíta-Rússland", flag: "🇧🇾" },
  { code: "+32", name: "Belgía", flag: "🇧🇪" },
  { code: "+501", name: "Belís", flag: "🇧🇿" },
  { code: "+229", name: "Benín", flag: "🇧🇯" },
  { code: "+975", name: "Bútan", flag: "🇧🇹" },
  { code: "+591", name: "Bólivía", flag: "🇧🇴" },
  { code: "+387", name: "Bosnía og Hersegóvína", flag: "🇧🇦" },
  { code: "+267", name: "Botsvana", flag: "🇧🇼" },
  { code: "+55", name: "Brasilía", flag: "🇧🇷" },
  { code: "+44", name: "Bretland", flag: "🇬🇧" },
  { code: "+673", name: "Brúnei", flag: "🇧🇳" },
  { code: "+359", name: "Búlgaría", flag: "🇧🇬" },
  { code: "+226", name: "Búrkína Fasó", flag: "🇧🇫" },
  { code: "+257", name: "Búrúndí", flag: "🇧🇮" },
  { code: "+855", name: "Kambódía", flag: "🇰🇭" },
  { code: "+237", name: "Kamerún", flag: "🇨🇲" },
  { code: "+1", name: "Kanada", flag: "🇨🇦" },
  { code: "+56", name: "Síle", flag: "🇨🇱" },
  { code: "+86", name: "Kína", flag: "🇨🇳" },
  { code: "+57", name: "Kólumbía", flag: "🇨🇴" },
  { code: "+506", name: "Kostaríka", flag: "🇨🇷" },
  { code: "+385", name: "Króatía", flag: "🇭🇷" },
  { code: "+53", name: "Kúba", flag: "🇨🇺" },
  { code: "+357", name: "Kýpur", flag: "🇨🇾" },
  { code: "+420", name: "Tékkland", flag: "🇨🇿" },
  { code: "+45", name: "Danmörk", flag: "🇩🇰" },
  { code: "+1809", name: "Dóminíska lýðveldið", flag: "🇩🇴" },
  { code: "+593", name: "Ekvador", flag: "🇪🇨" },
  { code: "+20", name: "Egyptaland", flag: "🇪🇬" },
  { code: "+503", name: "El Salvador", flag: "🇸🇻" },
  { code: "+372", name: "Eistland", flag: "🇪🇪" },
  { code: "+251", name: "Eþíópía", flag: "🇪🇹" },
  { code: "+679", name: "Fídjieyjar", flag: "🇫🇯" },
  { code: "+358", name: "Finnland", flag: "🇫🇮" },
  { code: "+33", name: "Frakkland", flag: "🇫🇷" },
  { code: "+995", name: "Georgía", flag: "🇬🇪" },
  { code: "+49", name: "Þýskaland", flag: "🇩🇪" },
  { code: "+233", name: "Gana", flag: "🇬🇭" },
  { code: "+30", name: "Grikkland", flag: "🇬🇷" },
  { code: "+502", name: "Gvatemala", flag: "🇬🇹" },
  { code: "+509", name: "Haítí", flag: "🇭🇹" },
  { code: "+504", name: "Hondúras", flag: "🇭🇳" },
  { code: "+852", name: "Hong Kong", flag: "🇭🇰" },
  { code: "+36", name: "Ungverjaland", flag: "🇭🇺" },
  { code: "+354", name: "Ísland", flag: "🇮🇸" },
  { code: "+91", name: "Indland", flag: "🇮🇳" },
  { code: "+62", name: "Indónesía", flag: "🇮🇩" },
  { code: "+98", name: "Íran", flag: "🇮🇷" },
  { code: "+964", name: "Írak", flag: "🇮🇶" },
  { code: "+353", name: "Írland", flag: "🇮🇪" },
  { code: "+972", name: "Ísrael", flag: "🇮🇱" },
  { code: "+39", name: "Ítalía", flag: "🇮🇹" },
  { code: "+225", name: "Fílabeinsströndin", flag: "🇨🇮" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+962", name: "Jórdanía", flag: "🇯🇴" },
  { code: "+7", name: "Kasakstan", flag: "🇰🇿" },
  { code: "+254", name: "Kenía", flag: "🇰🇪" },
  { code: "+965", name: "Kúveit", flag: "🇰🇼" },
  { code: "+371", name: "Lettland", flag: "🇱🇻" },
  { code: "+961", name: "Líbanon", flag: "🇱🇧" },
  { code: "+218", name: "Líbýa", flag: "🇱🇾" },
  { code: "+423", name: "Liechtenstein", flag: "🇱🇮" },
  { code: "+370", name: "Litháen", flag: "🇱🇹" },
  { code: "+352", name: "Lúxemborg", flag: "🇱🇺" },
  { code: "+60", name: "Malasía", flag: "🇲🇾" },
  { code: "+356", name: "Malta", flag: "🇲🇹" },
  { code: "+52", name: "Mexíkó", flag: "🇲🇽" },
  { code: "+373", name: "Moldóva", flag: "🇲🇩" },
  { code: "+377", name: "Mónakó", flag: "🇲🇨" },
  { code: "+976", name: "Mongólía", flag: "🇲🇳" },
  { code: "+382", name: "Svartfjallaland", flag: "🇲🇪" },
  { code: "+212", name: "Marokkó", flag: "🇲🇦" },
  { code: "+31", name: "Holland", flag: "🇳🇱" },
  { code: "+64", name: "Nýja-Sjáland", flag: "🇳🇿" },
  { code: "+505", name: "Níkaragva", flag: "🇳🇮" },
  { code: "+234", name: "Nígería", flag: "🇳🇬" },
  { code: "+47", name: "Noregur", flag: "🇳🇴" },
  { code: "+968", name: "Óman", flag: "🇴🇲" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+970", name: "Palestína", flag: "🇵🇸" },
  { code: "+507", name: "Panama", flag: "🇵🇦" },
  { code: "+595", name: "Paragvæ", flag: "🇵🇾" },
  { code: "+51", name: "Perú", flag: "🇵🇪" },
  { code: "+63", name: "Filippseyjar", flag: "🇵🇭" },
  { code: "+48", name: "Pólland", flag: "🇵🇱" },
  { code: "+351", name: "Portúgal", flag: "🇵🇹" },
  { code: "+974", name: "Katar", flag: "🇶🇦" },
  { code: "+40", name: "Rúmenía", flag: "🇷🇴" },
  { code: "+7", name: "Rússland", flag: "🇷🇺" },
  { code: "+250", name: "Rúanda", flag: "🇷🇼" },
  { code: "+966", name: "Sádi-Arabía", flag: "🇸🇦" },
  { code: "+221", name: "Senegal", flag: "🇸🇳" },
  { code: "+381", name: "Serbía", flag: "🇷🇸" },
  { code: "+65", name: "Singapúr", flag: "🇸🇬" },
  { code: "+421", name: "Slóvakía", flag: "🇸🇰" },
  { code: "+386", name: "Slóvenía", flag: "🇸🇮" },
  { code: "+27", name: "Suður-Afríka", flag: "🇿🇦" },
  { code: "+82", name: "Suður-Kórea", flag: "🇰🇷" },
  { code: "+34", name: "Spánn", flag: "🇪🇸" },
  { code: "+94", name: "Srí Lanka", flag: "🇱🇰" },
  { code: "+46", name: "Svíþjóð", flag: "🇸🇪" },
  { code: "+41", name: "Sviss", flag: "🇨🇭" },
  { code: "+963", name: "Sýrland", flag: "🇸🇾" },
  { code: "+886", name: "Taívan", flag: "🇹🇼" },
  { code: "+66", name: "Taíland", flag: "🇹🇭" },
  { code: "+216", name: "Túnis", flag: "🇹🇳" },
  { code: "+90", name: "Tyrkland", flag: "🇹🇷" },
  { code: "+256", name: "Úganda", flag: "🇺🇬" },
  { code: "+380", name: "Úkraína", flag: "🇺🇦" },
  { code: "+971", name: "Sameinuðu arabísku furstadæmin", flag: "🇦🇪" },
  { code: "+598", name: "Úrúgvæ", flag: "🇺🇾" },
  { code: "+998", name: "Úsbekistan", flag: "🇺🇿" },
  { code: "+58", name: "Venesúela", flag: "🇻🇪" },
  { code: "+84", name: "Víetnam", flag: "🇻🇳" },
  { code: "+967", name: "Jemen", flag: "🇾🇪" },
  { code: "+260", name: "Sambía", flag: "🇿🇲" },
  { code: "+263", name: "Simbabve", flag: "🇿🇼" },
];

/** Sorted list of unique calling codes longest-first, used to parse stored E.164 values */
const SORTED_CODES = Array.from(
  new Set([...COMMON_PHONE_COUNTRIES, ...ALL_PHONE_COUNTRIES].map((c) => c.code)),
).sort((a, b) => b.length - a.length);

/** Parse an E.164 (or legacy) phone string into { countryCode, local } */
export function parsePhone(stored: string | null | undefined): {
  countryCode: string;
  local: string;
} {
  if (!stored) return { countryCode: "+354", local: "" };
  const trimmed = stored.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");
  // Legacy 7-digit Icelandic
  if (!trimmed.startsWith("+") && digitsOnly.length === 7) {
    return { countryCode: "+354", local: digitsOnly };
  }
  const withPlus = trimmed.startsWith("+") ? trimmed : `+${digitsOnly}`;
  for (const code of SORTED_CODES) {
    if (withPlus.startsWith(code)) {
      return { countryCode: code, local: withPlus.slice(code.length).replace(/\D/g, "") };
    }
  }
  return { countryCode: "+354", local: digitsOnly };
}
