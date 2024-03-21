import { SkParagraph, SkTextFontFeatures, SkTextStyle, SkTypefaceFontProvider, Skia, TextAlign, TextHeightBehavior } from "@shopify/react-native-skia";
import { quranTextService, LineTextInfo } from "./qurantext.service";
import { BounceOutLeft } from "react-native-reanimated";


const lineParStyle = {
  textAlign: TextAlign.Left,
  textHeightBehavior: TextHeightBehavior.DisableAll
};

export interface JustInfo {
  fontFeatures: Map<number, SkTextFontFeatures[]>;
  textLineWidth: number;
}

export interface LayoutResult {
  paragraph: SkParagraph;
  parHeight: number;
  parWidth: number;
}

interface Action {
  name: string
  value?: number
  calcNewValue: (prev: number | undefined, curr: number) => number
}

interface Lookup {
  regExpr: RegExp;
  actions: { [key: string]: Action[]; }
}

const expaRegExp = new RegExp("^.*(?<expa>[صضسشفقبتثنكيئ])\\p{Mn}*$", "gdu");
export class JustService {

  private lineText: string
  private parInfiniteWidth: number

  constructor(private pageIndex: number, private lineIndex: number, private lineTextInfo: LineTextInfo,
    private fontMgr: SkTypefaceFontProvider, private initialLineWidth: number,
    private desiredWidth: number, private textStyle: SkTextStyle,
    private layOutResult: LayoutResult[]) {

    const pageText = quranTextService.quranText[pageIndex]

    this.lineText = pageText[lineIndex]

    this.parInfiniteWidth = 2 * desiredWidth
  }

  justifyLine(): JustInfo {

    const justInfo: JustInfo = { textLineWidth: this.initialLineWidth, fontFeatures: new Map<number, SkTextFontFeatures[]>() };

    const behafterbeh = `^\\p{L}.*(?<k1>[بتثني])\\p{Mn}*(?<k2>[بتثني])\\p{Mn}*(\\p{L}\\p{Mn}*)+$`

    const behBehLookup: Lookup = {
      regExpr: new RegExp(behafterbeh, "gdu"),
      actions: {
        k1: [{ name: 'cv01', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        k2: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + 2 * curr }]
      }
    }

    const right = "بتثنيئ" + "جحخ" + "سش" + "صض" + "طظ" + "عغ" + "فق" + "كلم" + "ه"
    const leftAsendant = "دا"
    const left = "ئبتثني" + "جحخ" + "طظ" + "عغ" + "فق" + "ةكم"

    const behnoonfina = "^.*[بتثني]\\p{Mn}*ن\\p{Mn}*$"
    /*
    const kashidaLookup2: Lookup = {
      regExpr: new RegExp(`${behnoonfina}|${behafterbeh}|^.*(?<k5>[${right}])\\p{Mn}*(?<k6>[${leftAsendant}]).*$|^.*(?<k3>[${right}])\\p{Mn}*(?<k4>[${left}]).*$`, "gdu"),
      actions: {
        k3: [{ name: 'cv01', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        k4: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + curr * 2 }],
        k5: [{ name: 'cv01', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        k6: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + curr }]
      }
    }*/

    const kashidaLookup2: Lookup = {
      regExpr: new RegExp(`${behnoonfina}|${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*((?<k4>[${left}]).*$|(?<k5>[${leftAsendant}]).*$)`, "gdu"),
      actions: {
        k3: [{ name: 'cv01', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        k4: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + curr * 2 }],        
        k5: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + curr }]
      }
    }

    const behHahLookup: Lookup = {
      regExpr: new RegExp(`^.*(?<k1>[بتثني])\\p{Mn}*(?<k2>[جحخ]).*$`, "gdu"),
      actions: {
        k1: [{ name: 'cv01', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        k2: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + curr }]
      }
    }

    const kafAltLookup: Lookup = {
      regExpr: new RegExp(`^.*(?<k1>[ك])\\p{Mn}*(?<k2>\\p{L}).*$`, "gdu"),
      actions: {
        k1: [{ name: 'cv03', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        k2: [{ name: 'cv03', calcNewValue: (prev, curr) => (prev || 0) + curr }]
      }
    }

    /*if (!(this.pageIndex == 10 && this.lineIndex == 13)) return justInfo;*/
    
    this.applyKashidas(justInfo, behBehLookup, 2)
    
    this.applyAlternates(justInfo, "بتثكن", 4)    
    
    
    this.applyAlternates(justInfo, "ىصضسشفقبتثنكيئ", 2)
    
    this.applyKashidas(justInfo, kafAltLookup, 1)
    
    this.applyAlternates(justInfo, "ىصضسشفقيئ", 2)

    this.applyDecomp(justInfo, "جحخ", "دا")
    this.applyDecomp(justInfo, "بتثني", "جحخ")

    this.applyKashidas(justInfo, kashidaLookup2, 2)

    this.applyKashidas(justInfo, behBehLookup, 2)

    this.applyKashidas(justInfo, kashidaLookup2, 2)

    
    
    this.applyKashidas(justInfo, behHahLookup, 4)
    this.applyKashidas(justInfo, behBehLookup, 2)
    this.applyKashidas(justInfo, kashidaLookup2, 1)

    
    
    
    return justInfo;


  }



  applyAlternates(justInfo: JustInfo, chars: string, nbLevels: number): Boolean {

    const wordInfos = this.lineTextInfo.wordInfos;

    let patternExpa = `^.*(?<expa>[${chars}])(\\p{Mn}*(?<fatha>\u064E)\\p{Mn}*|\\p{Mn}*)$`
    const regExprExpa = new RegExp(patternExpa, "gdu");

    const expaLookup: Lookup = {
      regExpr: regExprExpa,
      actions: {
        expa: [{ name: 'cv01', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        fatha: [{ name: 'cv01', calcNewValue: (prev, curr) => !prev ? 1 + Math.floor(curr / 3) : 1 + Math.floor((prev * 2.5 + curr) / 3) }]
      }
    }


    for (let i = 1; i <= nbLevels; i++) {
      for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
        this.applyLookup(justInfo, wordIndex, expaLookup, 1)
      }
    }

    return false
  }

  applyDecomp(justInfo: JustInfo, firstChars: string, secondChars: string): Boolean {

    const wordInfos = this.lineTextInfo.wordInfos;

    const decompLookup: Lookup = {
      regExpr: new RegExp(`^.*(?<k1>[${firstChars}])\\p{Mn}*(?<k2>[${secondChars}]).*$`, "gdu"),
      actions: {
        k1: [{ name: 'cv03', calcNewValue: (prev, curr) => 1 }],
        k2: [{ name: 'cv03', calcNewValue: (prev, curr) => 1 }]
      }
    }




    for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
      this.applyLookup(justInfo, wordIndex, decompLookup, 1)
    }


    return false
  }

  applyKashidas(justInfo: JustInfo, lookup: Lookup, nbLevels: number): Boolean {

    const wordInfos = this.lineTextInfo.wordInfos;

    for (let level = 1; level <= nbLevels; level++) {
      for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
        this.applyLookup(justInfo, wordIndex, lookup, 1)
      }
    }

    return false
  }

  applyLookup(justInfo: JustInfo, wordIndex: number, lookup: Lookup, level: number) {
    const wordInfos = this.lineTextInfo.wordInfos
    let result = justInfo.fontFeatures

    const wordInfo = wordInfos[wordIndex]
    let layout = this.layOutResult[wordIndex]
    lookup.regExpr.lastIndex = 0
    let match = lookup.regExpr.exec(wordInfo.text);

    if (!match) return

    let tempResult = new Map(result)

    const groups = match?.indices?.groups
    for (const key in groups) {
      let group = groups[key]
      if (!group) continue
      const nbChars = group[1] - group[0]
      let startIndex = group[0] + wordInfo.startIndex
      let endIndex = group[1] + wordInfo.startIndex - 1
      let actions = lookup.actions[key]

      if (!actions) continue

      let nbBases

      if (nbChars >= 2) {
        nbBases = 2
      } else {
        nbBases = 1
      }

      for (let i = 0; i < nbBases; i++) {
        if (actions[i]) {
          const action = actions[i]
          let prevValue: number
          const indexInLine = (i === 0 ? startIndex : endIndex)
          const prevFeatures = tempResult.get(indexInLine)
          let newValue = action.value || level
          let newFeatures;

          if (!prevFeatures) {
            newFeatures = [{ name: action.name, value: action?.calcNewValue(undefined, newValue) || newValue }]
          } else {
            let found = false;
            newFeatures = prevFeatures?.map(a => {
              if (a.name == action.name) {
                found = true
                return { name: action.name, value: action?.calcNewValue(a.value, newValue) || newValue }
              } else {
                return a
              }
            })
            if (!found) {
              newFeatures.push({ name: action.name, value: action?.calcNewValue(undefined, newValue) || newValue })
            }
          }
          tempResult.set(indexInLine, newFeatures)
        }
      }
    }

    const paragraph = this.shapeWord(wordIndex, tempResult)
    const wordNewWidth = paragraph.getLongestLine();
    if (/*wordNewWidth > layout.parWidth &&*/ justInfo.textLineWidth + wordNewWidth - layout.parWidth < this.desiredWidth) {
      justInfo.textLineWidth += wordNewWidth - layout.parWidth
      layout.parWidth = wordNewWidth
      justInfo.fontFeatures = tempResult
      result = tempResult
    }

  }

  shapeWord(wordIndex: number, justResults: Map<number, SkTextFontFeatures[]>): SkParagraph {

    const wordInfo = this.lineTextInfo.wordInfos[wordIndex];
    let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, this.fontMgr).pushStyle(this.textStyle);

    for (let i = wordInfo.startIndex; i <= wordInfo.endIndex; i++) {
      const char = this.lineText.charAt(i)

      const justInfo = justResults.get(i)
      if (justInfo) {

        const newtextStyle: SkTextStyle = {
          ...this.textStyle
        };


        if (justInfo) {
          newtextStyle.fontFeatures = justInfo
        }

        paragraphBuilder.pushStyle(newtextStyle)
        paragraphBuilder.addText(char)
        paragraphBuilder.pop()
      } else {
        paragraphBuilder.addText(char)
      }
    }

    let paragraph = paragraphBuilder.pop().build();

    paragraph.layout(this.parInfiniteWidth)

    return paragraph
  }
}