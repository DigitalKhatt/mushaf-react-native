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

type ActionFunction = {
  apply: (prev: SkTextFontFeatures[] | undefined, char: string) => SkTextFontFeatures[] | undefined
}
type ActionValue = {
  name: string
  value?: number
  calcNewValue: (prev: number | undefined, curr: number) => number,
}

type Action = ActionFunction | ActionValue

interface Appliedfeature {
  feature: SkTextFontFeatures
  calcNewValue?: (prev: number | undefined, curr: number) => number,
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
        k3: [{
          apply: (prev, char) => {
            let newFeatures: Appliedfeature[] = [{
              feature: { name: 'cv01', value: 1 },
              calcNewValue: (prev, curr) => (prev || 0) + curr
            }]
            if ("بتثنيئ".includes(char)) {
              newFeatures.push({ feature: { name: 'cv10', value: 1 } })
            }
            const features = this.mergeFeatures(prev, newFeatures)
            return features
          }
        }],
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

    const rightJoinLetter = "[ادذرزوؤأٱإ]";

    const startWordorSubWord = `(?:^|\\s|${rightJoinLetter}\\p{Mn}*)`

    this.applyDecomp(justInfo, "[ه]", "[م]", "cv11")
    this.applyDecomp(justInfo, "[بتثني]", "[جحخ]", "cv12")
    this.applyDecomp(justInfo, "[م]", "[جحخ]", "cv13")
    this.applyDecomp(justInfo, "[فق]", "[جحخ]", "cv14")
    this.applyDecomp(justInfo, "[ل]", "[جحخ]", "cv15")
    //this.applyDecomp(justInfo, `(?<!${startWordorSubWord}[لم]\\p{Mn}*)[جحخ]`, "[دا]", "cv16")
    this.applyDecomp(justInfo, `[جحخ]`, "[دا]", "cv16")
    this.applyDecomp(justInfo, "[سشصض]", "[ر]", "cv17")
    this.applyDecomp(justInfo, "[جحخ]", "[م]", "cv18")
    this.applyDecomp(justInfo, `[عغ]`, "[دا]", "cv16")

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

  applyDecomp(justInfo: JustInfo, firstChars: string, secondChars: string, featureName: string, firstLevel: number = 1, secondLevel: number = 1): Boolean {

    const wordInfos = this.lineTextInfo.wordInfos;

    const decompLookup: Lookup = {
      regExpr: new RegExp(`^.*(?<k1>${firstChars})\\p{Mn}*(?<k2>${secondChars}).*$`, "gdu"),
      actions: {
        k1: [{ name: featureName, calcNewValue: (prev, curr) => firstLevel }],
        k2: [{ name: featureName, calcNewValue: (prev, curr) => secondLevel }]
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

      let actions = lookup.actions[key]

      if (!actions) continue

      for (const action of actions) {
        let prevValue: number
        const indexInLine = group[0] + wordInfo.startIndex
        const prevFeatures = tempResult.get(indexInLine)
        let newFeatures: SkTextFontFeatures[] | undefined;
        if ("name" in action) {
          let newValue = action.value || level

          newFeatures = this.mergeFeatures(prevFeatures, [{ feature: { name: action.name, value: newValue }, calcNewValue: action.calcNewValue }])

        } else {
          newFeatures = action.apply(prevFeatures, wordInfo.text[group[0]])
        }

        if (newFeatures) {
          tempResult.set(indexInLine, newFeatures)
        } else {
          tempResult.delete(indexInLine)
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

  mergeFeatures(prevFeatures: SkTextFontFeatures[] | undefined, newFeatures: Appliedfeature[]): SkTextFontFeatures[] | undefined {

    let mergedFeatures: SkTextFontFeatures[] | undefined

    if (prevFeatures) {
      mergedFeatures = prevFeatures.map(x => Object.assign({}, x));
    } else {
      mergedFeatures = []
    }

    if (newFeatures) {
      for (const newFeature of newFeatures) {
        const exist = mergedFeatures.find(prevFeature => prevFeature.name == newFeature.feature.name)
        if (exist) {
          exist.value = newFeature.calcNewValue ? newFeature.calcNewValue(exist.value, newFeature.feature.value) : newFeature.feature.value
        } else {
          const cloneNewFeature = { name: newFeature.feature.name, value: newFeature.calcNewValue ? newFeature.calcNewValue(undefined, newFeature.feature.value) : newFeature.feature.value }
          mergedFeatures.push(cloneNewFeature)
        }
      }
    }

    return mergedFeatures
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