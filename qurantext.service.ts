import { quranText as quranTextOldMadinah } from './quran_text_old_madinah'

export const enum SpaceType {
  Simple = 1,
  Aya,
}
interface WordInfo {
  startIndex: number
  endIndex: number
  text: string
  baseText: string,
}
export interface LineTextInfo {
  ayaSpaceIndexes: number[];
  simpleSpaceIndexes: number[];
  spaces: Map<number, SpaceType>
  wordInfos: WordInfo[],

}
class QuranTextService {

  private quranInfo: any[];
  private _outline: any[] = [];
  private _quranText: string[][];
  private _sajsdas: any[] = [];
  private TafkhimRE!: RegExp;
  private OthersRE!: RegExp;
  private bases = new Set<number>();

  public rightNoJoinLetters = "ادذرزوؤأٱإءة";
  public dualJoinLetters = "بتثجحخسشصضطظعغفقكلمنهيئى"

  private madinaLineWidths = new Map([
    [600 * 15 + 9, 0.84],
    [602 * 15 + 5, 0.61],
    [602 * 15 + 15, 0.59],
    [603 * 15 + 10, 0.68],
    [604 * 15 + 4, 0.836],
    [604 * 15 + 9, 0.836],
    [604 * 15 + 14, 0.717],
    [604 * 15 + 15, 0.54],
  ]);


  private tajweedResuls: Map<number, Map<number, string>[]> = new Map()

  private LineTextInfoCache: Map<number, LineTextInfo> = new Map()
  constructor() {

    this._quranText = quranTextOldMadinah;

    this.initBases()

    const start = performance.now();

    const suraWord = "سُورَةُ";
    const bism = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

    const surabismpattern = "^(?<sura>"
      + suraWord + " .*)|(?<bism>"
      + bism
      + "|" + "بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
      + ")$";

    const sajdapatterns = "(وَٱسْجُدْ) وَٱقْتَرِب|(خَرُّوا۟ سُجَّدࣰا)|(وَلِلَّهِ يَسْجُدُ)|(يَسْجُدُونَ)۩|(فَٱسْجُدُوا۟ لِلَّهِ)|(وَٱسْجُدُوا۟ لِلَّهِ)|(أَلَّا يَسْجُدُوا۟ لِلَّهِ)|(وَخَرَّ رَاكِعࣰا)|(يَسْجُدُ لَهُ)|(يَخِرُّونَ لِلْأَذْقَانِ سُجَّدࣰا)|(ٱسْجُدُوا۟) لِلرَّحْمَٰنِ|ٱرْكَعُوا۟ (وَٱسْجُدُوا۟)"; // sajdapatterns.replace("\u0657", "\u08F0").replace("\u065E", "\u08F1").replace("\u0656", "\u08F2");
    const sajdaRegExpr = new RegExp(sajdapatterns, "du")


    const regexpr = new RegExp(surabismpattern, "u")

    const ratio = 0.9;
    for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
      const pageNumber = pageIndex + 1
      this.madinaLineWidths.set(pageNumber * 15 + 2, ratio * 0.5)
      this.madinaLineWidths.set(pageNumber * 15 + 3, ratio * 0.7)
      this.madinaLineWidths.set(pageNumber * 15 + 4, ratio * 0.9)
      this.madinaLineWidths.set(pageNumber * 15 + 5, ratio)
      this.madinaLineWidths.set(pageNumber * 15 + 6, ratio * 0.9)
      this.madinaLineWidths.set(pageNumber * 15 + 7, ratio * 0.7)
      this.madinaLineWidths.set(pageNumber * 15 + 8, ratio * 0.4)
    }

    this.quranInfo = [];
    for (let pageIndex = 0; pageIndex < this._quranText.length; pageIndex++) {
      const pageInfo: any[] = []
      this.quranInfo.push(pageInfo)
      const page = this._quranText[pageIndex];
      for (let lineIndex = 0; lineIndex < page.length; lineIndex++) {
        const line = page[lineIndex];
        const lineInfo: any = {}
        pageInfo.push(lineInfo)
        lineInfo.lineWidthRatio = this.madinaLineWidths.get((pageIndex + 1) * 15 + lineIndex + 1) || 1
        lineInfo.lineType = 0;
        const match = line.match(regexpr)
        if (match?.groups?.sura) {
          lineInfo.lineType = 1
          this._outline.push({
            name: match?.groups.sura,
            pageIndex: pageIndex,
            lineIndex: lineIndex
          })

        } else if (match?.groups?.bism) {
          lineInfo.lineType = 2
        }

        const sajdaMatch = line.match(sajdaRegExpr)
        if (sajdaMatch) {
          for (let i = 1; i < sajdaMatch.length; i++) {
            if (sajdaMatch[i]) {
              var pos = (sajdaMatch as any).indices[i]
              let startWordIndex = null;
              let endWordIndex = null;
              let currentWordIndex = 0;
              for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line.charAt(charIndex);

                const isSpace = char === " "

                if (startWordIndex == null && charIndex >= pos[0]) {
                  startWordIndex = currentWordIndex;
                }

                if (charIndex >= pos[1]) {
                  endWordIndex = currentWordIndex;
                  break;
                }

                if (isSpace) {
                  currentWordIndex++;
                }

              }
              lineInfo.sajda = { startWordIndex, endWordIndex }
              this._sajsdas.push({ pageIndex, lineIndex, startWordIndex, endWordIndex/*, words: sajdaMatch[i]*/ })
            }
          }
        }
      }
    }
    console.info(`sajdasMatched=${this._sajsdas.length}`);
    console.log(`QuranTextService constructor=${performance.now() - start}`)

    this.initTajweed()

  }

  private initBases() {
    for (let i = 0; i < this.dualJoinLetters.length; i++) {
      this.bases.add(this.dualJoinLetters.charCodeAt(i))
    }
    for (let i = 0; i < this.rightNoJoinLetters.length; i++) {
      this.bases.add(this.rightNoJoinLetters.charCodeAt(i))
    }
  }

  isLastBase(text: string, index: number) {

    for (let charIndex = index + 1; charIndex < text.length; charIndex++) {
      if (this.bases.has(text.charCodeAt(charIndex))) {
        return false
      }
    }
    return true
  }

  nbBases(text: string) {

    let nb = 0;

    for (let charIndex = 0; charIndex < text.length; charIndex++) {
      if (this.bases.has(text.charCodeAt(charIndex))) {
        nb++
      }
    }
    return nb
  }

  initTajweed() {


    // Tafkhim
    let pattern = "(?<tafkhim1>[طقصخغضظ]\u0651?[\u0652\u064B\u064E\u08F0\u064D\u0650\u08F2\u064C\u064F\u08F1])"

    // tafkhim Reh(8 possibilities http://www.quran-tajweed.net/tagweed/index.php/%D8%A7%D9%84%D8%B5%D9%81%D8%A7%D8%AA/%D8%AD%D8%A7%D9%84%D8%A7%D8%AA-%D8%AA%D9%81%D8%AE%D9%8A%D9%85-%D9%88%D8%AA%D8%B1%D9%82%D9%8A%D9%82-%D8%A7%D9%84%D8%B1%D8%A7%D8%A1)
    // http://www.dar-alquran.com/Detail.aspx?ArticleID=365

    // Dont Tafkhim
    // pos kasra /^reh/'lookup black @marks ( @marks | NULL ) ( @marks | NULL ) space /^aya|endofaya/;
    // pos /^ behshape / twodotsdown(sukun | NULL) /^ reh / 'lookup black  @marks ( @marks | NULL ) ( @marks | NULL ) space /^aya|endofaya/;
    pattern += "|(?:\u0650|\u064A\u0652?)ر\\p{Mn}+\\s۝"

    // pos /^reh/'lookup tafkim  (shadda | NULL)'lookup tafkim [fatha damma]'lookup tafkim     ;
    pattern += "|(?<tafkhim2>ر\u0651?[\u064E\u064F])"
    // pos wasla (/^reh/ sukun)'lookup tafkim;
    // pos [fatha damma] @bases (/dot/ | NULL) sukun  (/^reh/ sukun)'lookup tafkim;
    // pos [fatha damma] ([/^alef/ /^waw/] | NULL) (/^reh/ sukun)'lookup tafkim;	
    pattern += "|(?:ٱ|[\u0618\u0619](?:\\p{L}\u0652|[او]?))(?<tafkhim3>ر\u0652)"
    // pos [fatha damma] @bases (/dot/ | NULL) sukun  /^reh/'lookup tafkim  @marks ( @marks | NULL ) ( @marks | NULL ) space /^aya|endofaya/;
    // pos [fatha damma] ([/^alef/ /^waw/] | NULL) /^reh/'lookup tafkim  @marks ( @marks | NULL ) ( @marks | NULL ) space /^aya|endofaya/;
    pattern += "|[\u0618\u0619](?:\\p{L}\u0652|[او]?)(?<tafkhim4>ر)\\p{Mn}+\\s۝"
    // pos kasra (/^reh/ sukun)'lookup tafkim [/^sad/ /^tah/] | [/^ain/ /^hah/] onedotup | /^fehshape/ twodotsup;
    pattern += "|\u0650(?<tafkhim5>ر\u0652)[صطغخق]"

    this.TafkhimRE = new RegExp(pattern, "gdu");

    // gray
    pattern = "\\p{L}\\p{Mn}*(?<gray1>ٱ)(?!\u0644\\p{Mn}*ل\\p{Mn}*ه\\p{Mn}*(?:\\s|$))" // همزة الوصل داخل الكلمة
    pattern = pattern + "|ٱ(?<gray2>ل(?!\\p{Mn}*ل\\p{Mn}*ه\\p{Mn}*(?:\\s|$)))\\p{L}" // اللام الشمسية
    pattern = pattern + "|(?<gray3>\\p{L}\u06DF)"
    pattern = pattern + "|(?<gray4>[و])(?=\u0670)|(?<gray4_1>[ى])(?=\u0670\\p{L})"
    pattern = pattern + "|(?<gray5>ن)(?= [\u0646يمورل])"
    pattern = pattern + "|[\u064E\u064F\u0650](?<gray6>\\p{L})(?=\\s?\\p{L}\u0651)"

    //tanween
    pattern = pattern + "|(?<tanween1>\u0646[\u06E2\u06ED])|(?<tanween2>\u0646\u0651\\p{Mn})|(?<tanween3>[\u06E2\u06ED] \u0646)|(?<tanween4>\u0645 \u0628)|(?<tanween5>\u0646\\p{L})";
    pattern = pattern + "|(?<tanween6>[\u08F0\u08F1\u08F2\u0646])\\p{L}? (?<tanween7>[\u064A\u0648\u0645]\\p{Mn}\\p{Mn}?)"
    pattern = pattern + "|(?<tanween8>[\u08F0\u08F1\u08F2\u0646])\\p{L}? [\u0644\u0631]\u0651" // space [/^lam/ /^reh/] shadda

    pattern = pattern + "|(?<tanween9>[\u08F0\u08F1\u08F2\u0646])\\p{L}? \\p{L}" // space @bases;
    pattern = pattern + "|(?<tanween10>[من]\u0651\\p{Mn})" // /^meem|^noon/'lookup green shadda'lookup green @marks'lookup green;

    //madd
    pattern = pattern + "|(?<madd1>[او\u0670\u06E5\u06E6]\u0653)(?=\\p{L}\u0651)" // pos ([/^alef/ /^waw/ /^smallalef/ smallwaw smallyeh] maddahabove)'lookup red4 @bases  (/dot/ | NULL) shadda;
    pattern = pattern + "|(?<madd2>[\u0670\u06E5\u06E6])" // pos [smallwaw smallyeh smallalef.joined smallalef.isol smallalef.replacement]'lookup red1 @bases;
    pattern = pattern + "|[او\u0670\u06E5\u06E6]\u0653\\s۝" // pos ([/^alef/ /^waw/ /^smallalef/ smallwaw smallyeh] maddahabove)' space /^aya|endofaya/;
    pattern = pattern + "|(?<madd3>[لم]\u0653)" // pos ([/^lam/ /^meem/ ] maddahabove)'lookup red4;
    pattern = pattern + "|(?<madd4>[اويى\u0670\u06E5\u06E6]\u0653)" // pos ([/^alef/ /^waw/ /^alefmaksura/ /^yehshape/ /^smallalef/ smallwaw smallyeh ] maddahabove)'lookup red3;
    pattern = pattern + "|(?<madd5>[ياو\u0670]\u0652?)(?=\\p{L}\\p{Mn}\\p{Mn}?\\s۝)" // pos  /^waw/'lookup red2 (sukun | NULL)'lookup red2 @bases @marks ( @marks | NULL ) space /^aya|endofaya/;

    // kalkala
    pattern = pattern + "|(?<kalkala1>[\u0637\u0642\u062F\u062C\u0628]\u0652)"
    pattern = pattern + "|(?<kalkala2>[\u0637\u0642\u062F\u062C\u0628]) \u06DD"

    this.OthersRE = new RegExp(pattern, "gdu");
  }

  getLineInfo(pageIndex: number, lineIndex: number): any {
    return this.quranInfo[pageIndex][lineIndex]
  }

  get outline(): any[] {
    return this._outline;
  }

  get nbPages(): number {
    return this._quranText.length
  }

  get sajdas(): any[] {
    return this._sajsdas
  }
  get quranText(): string[][] {
    return this._quranText
  }

  getTajweed(pageIndex: number, plineIndex: number): Map<number, string> {


    let pageResult = this.tajweedResuls.get(pageIndex)
    if (pageResult == null) {
      pageResult = []
      this.tajweedResuls.set(pageIndex, pageResult)
    } else {
      return pageResult[plineIndex]
    }

    const pageText = this.quranText[pageIndex];

    for (let lineIndex = 0; lineIndex < pageText.length; lineIndex++) {
      const lineText = this.quranText[pageIndex][lineIndex]


      // TODO
      const preText = ""
      const postText = ""

      const text = preText + lineText + postText


      let matches = text.matchAll(this.TafkhimRE);
      let match: any
      let group;

      const result = new Map<number, string>();

      pageResult.push(result)

      for (match of matches) {
        const groups = match.indices.groups
        if (group = groups.tafkhim1) {
          let firstPos = group[0] - preText.length;
          result.set(firstPos, "tafkim")
          result.set(firstPos + 1, "tafkim")
          if (group[0] + 2 < group[1]) {
            result.set(firstPos + 2, "tafkim")
          }
        } else if (group = groups.tafkhim2) {
          let firstPos = group[0] - preText.length;
          result.set(firstPos, "tafkim")
          result.set(firstPos + 1, "tafkim")
          if (group[0] + 2 < group[1]) {
            result.set(firstPos + 2, "tafkim")
          }
        } else if (group = groups.tafkhim3) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "tafkim")
          result.set(firstPos + 1, "tafkim")
        } else if (group = groups.tafkhim4) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "tafkim")
        } else if (group = groups.tafkhim5) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "tafkim")
          result.set(firstPos + 1, "tafkim")
        }
      }


      matches = text.matchAll(this.OthersRE);

      for (match of matches) {
        const groups = match.indices.groups
        if (group = groups.tanween1) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
          result.set(firstPos + 1, "green");
        } else if (group = groups.tanween2) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "green");
          result.set(firstPos + 1, "green");
          result.set(firstPos + 2, "green");
        } else if (group = groups.tanween3) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "green");
        } else if (group = groups.tanween4) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "green");
        } else if (group = groups.tanween5) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "green");
        } else if (group = groups.tanween6) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
          const tanween7Group = groups.tanween7
          const greenPos = tanween7Group[0] - preText.length;
          result.set(greenPos, "green");
          result.set(greenPos + 1, "green");
          if (tanween7Group[0] + 2 < tanween7Group[1]) {
            result.set(greenPos + 2, "green");
          }
        } else if (group = groups.tanween8) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
        } else if (group = groups.tanween9) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "green");
        }
        else if (group = groups.tanween10) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "green");
          result.set(firstPos + 1, "green");
          result.set(firstPos + 2, "green");
        } else if (group = groups.gray1) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
        } else if (group = groups.gray2) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
        } else if (group = groups.gray3) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
          result.set(firstPos + 1, "lgray");
        } else if (group = groups.gray4 || groups.gray4_1) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
        } else if (group = groups.gray5) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
        } else if (group = groups.gray6) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lgray");
        } else if (group = groups.kalkala1) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lkalkala");
          result.set(firstPos + 1, "lkalkala");
        } else if (group = groups.kalkala2) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "lkalkala");
        } else if (group = groups.madd1) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "red4");
          result.set(firstPos + 1, "red4");
        } else if (group = groups.madd2) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "red1");
        } else if (group = groups.madd3) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "red4");
          result.set(firstPos + 1, "red4");
        } else if (group = groups.madd4) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "red3");
          result.set(firstPos + 1, "red3");
        } else if (group = groups.madd5) {
          const firstPos = group[0] - preText.length;
          result.set(firstPos, "red2");
          if (group[0] + 1 < group[1]) {
            result.set(firstPos + 1, "red2");
          }
        }
      }
    }


    return pageResult[plineIndex]
  }




  analyzeText(pageIndex: number, plineIndex: number): LineTextInfo {

    const key = pageIndex * 15 + plineIndex
    let lineTextInfo = this.LineTextInfoCache.get(key)

    if (lineTextInfo) return lineTextInfo

    lineTextInfo = {
      ayaSpaceIndexes: [],
      simpleSpaceIndexes: [],
      wordInfos: [],
      spaces: new Map()
    }

    this.LineTextInfoCache.set(key, lineTextInfo)

    const pageText = this.quranText[pageIndex];


    const lineText = this.quranText[pageIndex][plineIndex]
    let currentWord: WordInfo = { text: "", startIndex: 0, endIndex: -1, baseText: "" };
    lineTextInfo.wordInfos.push(currentWord);
    for (let i = 0; i < lineText.length; i++) {
      const char = lineText.charAt(i);
      if (char === " ") {

        if ((lineText.charCodeAt(i - 1) >= 0x0660 && lineText.charCodeAt(i - 1) <= 0x0669) || (lineText.charCodeAt(i + 1) === 0x06DD)) {
          lineTextInfo.ayaSpaceIndexes.push(i)
          lineTextInfo.spaces.set(i, SpaceType.Aya)
        } else {
          lineTextInfo.simpleSpaceIndexes.push(i)
          lineTextInfo.spaces.set(i, SpaceType.Simple)
        }        
        currentWord = { text: "", startIndex: i + 1, endIndex: i, baseText: "" }
        lineTextInfo.wordInfos.push(currentWord);

      } else {
        currentWord.text += char;
        if (this.bases.has(char.charCodeAt(0))) {
          currentWord.baseText += char;
        }
        currentWord.endIndex++;
      }
    }
    

    return lineTextInfo;
  }
}

export const quranTextService = new QuranTextService();


export const PAGE_WIDTH = 17000
export const INTERLINE = 1800
export const TOP = 200
export const MARGIN = 400
export const FONTSIZE = 1000
export const SPACEWIDTH = 100
