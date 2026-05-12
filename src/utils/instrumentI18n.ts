import type { TFunction } from "i18next";

const INSTRUMENT_NAME_ALIASES: Record<string, string> = {
  conductor: "conductor",
  "дирижер": "conductor",
  "дирижёр": "conductor",
  violin: "violin",
  "скрипка": "violin",
  viola: "viola",
  "альт": "viola",
  cello: "cello",
  violoncello: "cello",
  "виолончель": "cello",
  "double bass": "doubleBass",
  "double-bass": "doubleBass",
  contrabass: "doubleBass",
  "контрабас": "doubleBass",
  flute: "flute",
  "флейта": "flute",
  "alto flute": "altoFlute",
  "альтовая флейта": "altoFlute",
  piccolo: "piccolo",
  "пикколо": "piccolo",
  oboe: "oboe",
  "гобой": "oboe",
  "english horn": "englishHorn",
  "английский рожок": "englishHorn",
  clarinet: "clarinet",
  "кларнет": "clarinet",
  "bass clarinet": "bassClarinet",
  "бас кларнет": "bassClarinet",
  "бас-кларнет": "bassClarinet",
  bassoon: "bassoon",
  "фагот": "bassoon",
  contrabassoon: "contrabassoon",
  "контрафагот": "contrabassoon",
  "soprano saxophone": "sopranoSaxophone",
  "soprano-saxophone": "sopranoSaxophone",
  "сопрано саксофон": "sopranoSaxophone",
  "саксофон сопрано": "sopranoSaxophone",
  "alto saxophone": "altoSaxophone",
  "alto-saxophone": "altoSaxophone",
  "альт саксофон": "altoSaxophone",
  "tenor saxophone": "tenorSaxophone",
  "tenor-saxophone": "tenorSaxophone",
  "тенор саксофон": "tenorSaxophone",
  "baritone saxophone": "baritoneSaxophone",
  "baritone-saxophone": "baritoneSaxophone",
  "баритон саксофон": "baritoneSaxophone",
  saxophone: "saxophone",
  "саксофон": "saxophone",
  trumpet: "trumpet",
  "труба": "trumpet",
  cornet: "cornet",
  "корнет": "cornet",
  flugelhorn: "flugelhorn",
  "флюгельгорн": "flugelhorn",
  trombone: "trombone",
  "тромбон": "trombone",
  "bass trombone": "bassTrombone",
  "bass-trombone": "bassTrombone",
  "бас тромбон": "bassTrombone",
  "бас-тромбон": "bassTrombone",
  tuba: "tuba",
  "туба": "tuba",
  euphonium: "euphonium",
  "эуфониум": "euphonium",
  horn: "frenchHorn",
  "french horn": "frenchHorn",
  "валторна": "frenchHorn",
  triangle: "triangle",
  "треугольник": "triangle",
  "tam tam": "tamTam",
  "tam-tam": "tamTam",
  "там там": "tamTam",
  "там-там": "tamTam",
  timpani: "timpani",
  "литавры": "timpani",
  xylophone: "xylophone",
  "ксилофон": "xylophone",
  marimba: "marimba",
  "маримба": "marimba",
  vibraphone: "vibraphone",
  "вибрафон": "vibraphone",
  glockenspiel: "glockenspiel",
  "колокольчики": "glockenspiel",
  "tubular bells": "tubularBells",
  "tubular-bells": "tubularBells",
  "трубчатые колокола": "tubularBells",
  piano: "piano",
  "фортепиано": "piano",
  harpsichord: "harpsichord",
  "клавесин": "harpsichord",
  organ: "organ",
  "орган": "organ",
  keyboard: "keyboard",
  synthesizer: "synthesizer",
  "синтезатор": "synthesizer",
  "клавиши": "keyboard",
  guitar: "guitar",
  "гитара": "guitar",
  "electric guitar": "electricGuitar",
  "электрогитара": "electricGuitar",
  "bass guitar": "bassGuitar",
  "бас-гитара": "bassGuitar",
  drums: "drums",
  drum: "drums",
  "барабаны": "drums",
  percussion: "percussion",
  "перкуссия": "percussion",
  vocal: "vocal",
  voice: "vocal",
  "вокал": "vocal",
  "choir soprano": "choirSoprano",
  "choir-soprano": "choirSoprano",
  "хор сопрано": "choirSoprano",
  "choir alto": "choirAlto",
  "choir-alto": "choirAlto",
  "хор альт": "choirAlto",
  "choir tenor": "choirTenor",
  "choir-tenor": "choirTenor",
  "хор тенор": "choirTenor",
  "choir bass": "choirBass",
  "choir-bass": "choirBass",
  "хор бас": "choirBass",
  choir: "choir",
  "хор": "choir",
  accordion: "accordion",
  "аккордеон": "accordion",
  harp: "harp",
  "арфа": "harp",
  ukulele: "ukulele",
  "укулеле": "ukulele",
};

function normalizeInstrumentName(name: string): string {
  return name.trim().toLowerCase().replace(/[._/-]+/g, " ").replace(/\s+/g, " ");
}

export function resolveInstrumentTranslationKey(name: string): string | null {
  const normalized = normalizeInstrumentName(name);
  const direct = INSTRUMENT_NAME_ALIASES[normalized];
  if (direct) return direct;

  if (normalized.includes("саксофон") || normalized.includes("saxophone")) return "saxophone";
  if (normalized.includes("гитар") || normalized.includes("guitar")) {
    if (normalized.includes("бас") || normalized.includes("bass")) return "bassGuitar";
    if (normalized.includes("электр") || normalized.includes("electric")) return "electricGuitar";
    return "guitar";
  }
  if (normalized.includes("клавиш") || normalized.includes("keyboard") || normalized.includes("synth")) {
    return normalized.includes("synth") ? "synthesizer" : "keyboard";
  }
  if (normalized.includes("фортеп") || normalized.includes("пиано") || normalized.includes("piano")) return "piano";
  if (normalized.includes("барабан") || normalized.includes("drum")) return "drums";
  if (normalized.includes("перкус") || normalized.includes("percussion")) return "percussion";
  if (normalized.includes("вокал") || normalized.includes("vocal") || normalized.includes("voice")) return "vocal";
  if (normalized.includes("хор") || normalized.includes("choir") || normalized.includes("chorus")) return "choir";
  if (normalized.includes("валтор") || normalized.includes("french horn") || normalized.includes("horn")) return "frenchHorn";
  if (normalized.includes("контрабас") || normalized.includes("double bass") || normalized.includes("contrabass")) return "doubleBass";
  if (normalized.includes("виолонч") || normalized.includes("cello") || normalized.includes("violoncello")) return "cello";

  return null;
}

export function getInstrumentLabel(name: string, t: TFunction): string {
  const key = resolveInstrumentTranslationKey(name);
  if (!key) return name;
  return String(t(`organizations.instrumentNames.${key}`, { defaultValue: name }));
}
