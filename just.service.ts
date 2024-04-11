import { SkParagraph, SkParagraphBuilder, SkParagraphStyle, SkTextFontFeatures, SkTextStyle, SkTypefaceFontProvider, Skia, TextAlign, TextDirection, TextHeightBehavior } from "@shopify/react-native-skia";
import { quranTextService, PAGE_WIDTH, FONTSIZE, MARGIN, INTERLINE, TOP, SPACEWIDTH, SpaceType, LineTextInfo } from './qurantext.service'

import { compress, decompress } from 'lz-string';


const lineParStyle = {
  textAlign: TextAlign.Left,
  textHeightBehavior: TextHeightBehavior.DisableAll
};

export interface JustInfo {
  fontFeatures: Map<number, SkTextFontFeatures[]>;
  desiredWidth: number;
  textLineWidth: number;
  layoutResult: LayoutResult[]
}

export interface JustResultByLine {
  fontFeatures: Map<number, SkTextFontFeatures[]>; /* FontFeatures by character index in the line */ 
  simpleSpacing: number;
  ayaSpacing: number;
  fontSizeRatio: number;
}

export interface LayoutResult {
  parHeight: number;
  parWidth: number;
}

export interface LookupContext {
  justInfo: JustInfo,
  wordIndex: number,
  groups?: {
    [key: string]: [number, number];
  };
}

export interface ApplyContext {
  prevFeatures: SkTextFontFeatures[] | undefined,
  char: string,
  wordIndex: number,
  charIndex: number
}

type ActionFunction = {
  apply: (context: ApplyContext) => SkTextFontFeatures[] | undefined
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
  condition?: (context: LookupContext) => boolean
  matchingCondition?: (context: LookupContext) => boolean
  regExprs: RegExp | RegExp[];
  actions: { [key: string]: Action[]; }
}

const expaRegExp = new RegExp("^.*(?<expa>[صضسشفقبتثنكيئ])\\p{Mn}*$", "gdu");


const finalIsolAlternates = "ىصضسشفقبتثنكيئ"

const other = "[\\p{Mn}\u06E5]*"

const dualJoinLetters = quranTextService.dualJoinLetters
const rightNoJoinLetters = quranTextService.rightNoJoinLetters


export class JustService {

  private lineText: string
  private textStyle: SkTextStyle
  private parInfiniteWidth;
  private lineWidth = 2000; /* arbitrary number */
  private desiredWidth: number;
  private fontSize: number;
  private paraBuilder: SkParagraphBuilder;


  constructor(private pageIndex: number, private lineIndex: number, private lineTextInfo: LineTextInfo,
    private fontMgr: SkTypefaceFontProvider, private fontSizeLineWidthRatio: number, private lineWidthRatio: number, pParBuilder?: SkParagraphBuilder) {

    this.desiredWidth = lineWidthRatio * this.lineWidth;

    const pageText = quranTextService.quranText[pageIndex]

    this.lineText = pageText[lineIndex]

    this.parInfiniteWidth = 1.5 * this.desiredWidth

    this.fontSize = this.fontSizeLineWidthRatio * this.lineWidth

    this.textStyle = {
      fontFamilies: ["oldmadina"],
      fontSize: this.fontSize
    };

    if (pParBuilder) {
      this.paraBuilder = pParBuilder
    } else {
      this.paraBuilder = Skia.ParagraphBuilder.Make(lineParStyle, this.fontMgr);
    }


  }


  justifyLine(): JustResultByLine {

    const desiredWidth = this.desiredWidth

    const pageText = quranTextService.quranText[this.pageIndex]

    let scale = this.fontSize / FONTSIZE;

    let fontSize = this.fontSize

    const defaultSpaceWidth = SPACEWIDTH * scale

    const lineText = pageText[this.lineIndex]

    const lineTextInfo = this.lineTextInfo


    let layOutResult = []
    let wordWidths: any[] = []
    let spaceWidths: any[] = []

    let justResults: JustInfo | undefined


    let simpleSpaceWidth;
    let ayaSpaceWidth;

    const totalSpaces = lineTextInfo.ayaSpaceIndexes.length + lineTextInfo.simpleSpaceIndexes.length;

    let textWidthByWord = defaultSpaceWidth * totalSpaces

    for (let wordIndex = 0; wordIndex < lineTextInfo.wordInfos.length; wordIndex++) {
      const wordInfo = lineTextInfo.wordInfos[wordIndex]



      //let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, this.fontMgr).pushStyle(this.textStyle);

      let paragraphBuilder = this.paraBuilder
      paragraphBuilder.reset()
      paragraphBuilder.pushStyle(this.textStyle)


      paragraphBuilder.addText(wordInfo.text)
      let paragraph = paragraphBuilder.pop().build();
      paragraph.layout(this.parInfiniteWidth);
      const parHeight = paragraph.getHeight();
      const parWidth = paragraph.getLongestLine();

      textWidthByWord += parWidth

      layOutResult.push({
        parHeight,
        parWidth,
      })
      paragraph.dispose()


    }

    let getTextWidth = () => {

      //let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, this.fontMgr).pushStyle(this.textStyle);

      let paragraphBuilder = this.paraBuilder
      paragraphBuilder.reset()
      paragraphBuilder.pushStyle(this.textStyle)

      paragraphBuilder.addText(lineText)
      let paragraph = paragraphBuilder.pop().build();
      paragraph.layout(this.parInfiniteWidth);
      const parHeight = paragraph.getHeight();
      const parWidth = paragraph.getLongestLine();
      //paragraphBuilder.dispose()
      paragraph.dispose()
      /*
      let prevRect: SkRect | undefined;
      for (let wordIndex = 0; wordIndex < lineTextInfo.wordInfos.length; wordIndex++) {
        const wordInfo = lineTextInfo.wordInfos[wordIndex]
        //const endIndex = wordIndex === (lineTextInfo.wordInfos.length - 1) ? lineText.length : lineTextInfo.wordInfos[wordIndex + 1].startIndex - 1
        const endIndex = wordInfo.endIndex + 1
        const rect = paragraph.getRectsForRange(wordInfo.startIndex, endIndex)
        const currRect = rect[0]
        wordWidths.push(currRect);
        if (prevRect) {
          const spaceWidth = prevRect.x - currRect.width
          spaceWidths.push(spaceWidth)
        }
        prevRect = rect[0];
      }*/
      return parWidth
    }

    let currentLineWidth = getTextWidth()

    let diff = desiredWidth - currentLineWidth

    let fontSizeRatio = 1
    let simpleSpacing = SPACEWIDTH
    let ayaSpacing = SPACEWIDTH

    if (diff > 0) {
      // stretch   

      let maxStretchBySpace = defaultSpaceWidth * 0.5;
      let maxStretchByAyaSpace = defaultSpaceWidth * 2;

      let maxStretch = maxStretchBySpace * lineTextInfo.simpleSpaceIndexes.length + maxStretchByAyaSpace * lineTextInfo.ayaSpaceIndexes.length;

      let stretch = Math.min(desiredWidth - currentLineWidth, maxStretch);
      let spaceRatio = maxStretch != 0 ? stretch / maxStretch : 0;
      let stretchBySpace = spaceRatio * maxStretchBySpace;
      let stretchByByAyaSpace = spaceRatio * maxStretchByAyaSpace;

      simpleSpaceWidth = defaultSpaceWidth + stretchBySpace
      ayaSpaceWidth = defaultSpaceWidth + stretchByByAyaSpace

      currentLineWidth += stretch

      // stretching

      if (desiredWidth > currentLineWidth) {
        justResults = this.stretchLine(layOutResult, currentLineWidth, desiredWidth)
        currentLineWidth = justResults.textLineWidth
      }



      if (desiredWidth > currentLineWidth) {
        // full justify with space
        let addToSpace = (desiredWidth - currentLineWidth) / lineTextInfo.spaces.size
        simpleSpaceWidth += addToSpace
        ayaSpaceWidth += addToSpace
      }

      simpleSpacing = (simpleSpaceWidth / scale)
      ayaSpacing = (ayaSpaceWidth / scale)


    } else {
      //shrink
      fontSizeRatio = desiredWidth / currentLineWidth;
      // TODO : add shrinking features to the font
      //shrink by changing font size for now 
      fontSize = fontSize * fontSizeRatio

    }

    return { fontFeatures: justResults?.fontFeatures || new Map<number, SkTextFontFeatures[]>, simpleSpacing, ayaSpacing, fontSizeRatio }
  }


  stretchLine(layoutResult: LayoutResult[], initialLineWidth: number, desiredWidth: number): JustInfo {



    const right = "بتثنيئ" + "جحخ" + "سش" + "صض" + "طظ" + "عغ" + "فق" + "لم" + "ه"


    const wordInfos = this.lineTextInfo.wordInfos;

    const justInfo: JustInfo = { textLineWidth: initialLineWidth, fontFeatures: new Map<number, SkTextFontFeatures[]>(), layoutResult, desiredWidth };

    const behafterbeh = `^.*(?:[${dualJoinLetters}]\\p{Mn}*)+(?<k1>[بتثنيسشصض])\\p{Mn}*(?<k2>[بتثنيم])\\p{Mn}*(?:\\p{L}\\p{Mn}*)+$`

    const behBehLookup: Lookup = {
      regExprs: new RegExp(behafterbeh, "gdu"),
      actions: {
        k1: [{
          apply: (context) => {
            let newFeatures: Appliedfeature[] = [{
              feature: { name: 'cv01', value: 1 },
              calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6)
            }]
            if ("بتثنيئ".includes(context.char)) {
              newFeatures.push({ feature: { name: 'cv10', value: 1 } })
            }
            const features = this.mergeFeatures(context.prevFeatures, newFeatures)
            return features
          }
        }],
        k2: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + 2 * curr }]
      }
    }


    const finalAssendantRegExprs = [
      new RegExp(`${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k4>["آادذٱأإ"]).*$`, "gdu"),
      new RegExp(`${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k4>[كله])\\p{Mn}[${rightNoJoinLetters}].*$`, "gdu"),
    ]
    const finalAssensantLookup: Lookup = {
      regExprs: finalAssendantRegExprs,
      matchingCondition: (context) => this.matchingCondition(context),
      actions: {
        k3: [{
          apply: (context) => {
            let newFeatures: Appliedfeature[] = [{
              feature: { name: 'cv01', value: 1 },
              calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6)
            }]
            if ("بتثنيئ".includes(context.char)) {
              newFeatures.push({ feature: { name: 'cv10', value: 1 } })
            }
            const features = this.mergeFeatures(context.prevFeatures, newFeatures)
            return features
          }
        }],
        k4: [{ name: 'cv02', calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6) }]
      }
    }

    const left = "ئبتثني" + "جحخ" + "طظ" + "عغ" + "فق" + "ةلم" + "ر"
    const mediLeftAsendant = "ل"

    const generalKashidaLookup: Lookup = {
      regExprs: [
        ...finalAssendantRegExprs,
        new RegExp(`${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k5>[${mediLeftAsendant}]).*$`, "gdu"),
        //new RegExp(`${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k5>[ل])\\p{Mn}*[ك].*$`, "gdu"),
        new RegExp(`${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k5>[${left}]).*$`, "gdu")
      ],
      matchingCondition: (context) => this.matchingCondition(context),
      condition: (context) => {
        let group = context?.groups?.["k5"]
        if (group) {
          const wordInfo = wordInfos[context.wordIndex]
          const indexInLine = group[0] + wordInfo.startIndex
          const prevFeatures = context.justInfo.fontFeatures.get(indexInLine)
          const charIndex = group[0]
          const char = wordInfo.text[charIndex]
          if (finalIsolAlternates.includes(char) && /*prevFeatures?.find(a => a.name == "cv01") &&*/ quranTextService.isLastBase(wordInfo.text, charIndex)) {
            return false
          }
        }
        return true
      },
      actions: {
        k3: [{
          apply: (context) => {
            let newFeatures: Appliedfeature[] = [{
              feature: { name: 'cv01', value: 1 },
              calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6)
            }]
            if ("بتثنيئ".includes(context.char)) {
              newFeatures.push({ feature: { name: 'cv10', value: 1 } })
            }
            const features = this.mergeFeatures(context.prevFeatures, newFeatures)
            return features
          }
        }],
        k4: [{ name: 'cv02', calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6) }],
        k5: [{ name: 'cv02', calcNewValue: (prev, curr) => (prev || 0) + curr * 2 }]
      }
    }

    const kafAltLookup: Lookup = {
      regExprs: new RegExp(`^.*(?<k1>[ك])\\p{Mn}*(?<k2>\\p{L}).*$`, "gdu"),
      actions: {
        k1: [{ name: 'cv03', calcNewValue: (prev, curr) => 1 }],
        k2: [{ name: 'cv03', calcNewValue: (prev, curr) => 1 }]
      }
    }



    //if (!(this.pageIndex == 2 && this.lineIndex == 8)) return justInfo;


    this.applyLookupInc(justInfo, behBehLookup, 2)
    this.applyAlternates(justInfo, "بتثكن", 2)
    this.applyLookupInc(justInfo, finalAssensantLookup, 2)
    this.applyLookupInc(justInfo, generalKashidaLookup, 1)
    this.applyDecomp(justInfo, `[جحخ]`, `[هكلذداة]`, "cv16", 2, 4)



    this.applyDecomp(justInfo, "[ه]", "[م]", "cv11", 1, 2)
    this.applyDecomp(justInfo, "[بتثني]", "[جحخ]", "cv12", 1, 2)
    this.applyDecomp(justInfo, "[م]", "[جحخ]", "cv13", 1, 2)
    this.applyDecomp(justInfo, "[فق]", "[جحخ]", "cv14", 1, 2)
    this.applyDecomp(justInfo, "[ل]", "[جحخ]", "cv15", 1, 2)

    this.applyDecomp(justInfo, "[سشصض]", "[ر]", "cv17", 1, 2)
    this.applyDecomp(justInfo, "[جحخ]", "[م]", "cv18", 1, 2)
    this.applyDecomp(justInfo, `[عغ]`, "[دذا]", "cv16", 1, 1)


    this.applyAlternates(justInfo, "ىصضسشفقيئ", 2)

    this.applyLookupInc(justInfo, kafAltLookup, 1)

    this.applyLookupInc(justInfo, behBehLookup, 1)
    this.applyAlternates(justInfo, "بتثكن", 1)
    this.applyLookupInc(justInfo, finalAssensantLookup, 1)
    this.applyLookupInc(justInfo, generalKashidaLookup, 1)



    this.applyAlternates(justInfo, "ىصضسشفقيئ", 1)



    this.applyLookupInc(justInfo, behBehLookup, 2)

    this.applyAlternates(justInfo, "بتثكن", 2)
    this.applyAlternates(justInfo, "ىصضسشفقيئ", 2)

    this.applyLookupInc(justInfo, generalKashidaLookup, 2)

    return justInfo;


  }



  applyAlternates(justInfo: JustInfo, chars: string, nbLevels: number): Boolean {

    const wordInfos = this.lineTextInfo.wordInfos;

    let patternExpa = `^.*(?<expa>[${chars}])(\\p{Mn}*(?<fatha>\u064E)\\p{Mn}*|\\p{Mn}*)$`
    const regExprExpa = new RegExp(patternExpa, "gdu");

    const expaLookup: Lookup = {
      regExprs: regExprExpa,
      actions: {
        expa: [{ name: 'cv01', calcNewValue: (prev, curr) => (prev || 0) + curr }],
        fatha: [{ name: 'cv01', calcNewValue: (prev, curr) => !prev ? 1 + Math.floor(curr / 3) : 1 + Math.floor((prev * 2.5 + curr) / 3) }]
      }
    }

    this.applyLookupInc(justInfo, expaLookup, nbLevels)



    return false
  }

  applyDecomp(justInfo: JustInfo, firstChars: string, secondChars: string, featureName: string, firstLevel?: number, secondLevel?: number): Boolean {

    const wordInfos = this.lineTextInfo.wordInfos;

    const decompLookup: Lookup = {
      regExprs: new RegExp(`^.*(?<k1>${firstChars})\\p{Mn}*(?<k2>${secondChars}).*$`, "gdu"),
      actions: {
        k1: [{ name: featureName, calcNewValue: (prev, curr) => 1 }],
        k2: [{ name: featureName, calcNewValue: (prev, curr) => 1 }]
      }
    }

    if (firstLevel) {
      decompLookup.actions.k1.push({ name: "cv01", calcNewValue: (prev, curr) => firstLevel })
    }

    if (secondLevel) {
      decompLookup.actions.k2.push({ name: "cv02", calcNewValue: (prev, curr) => secondLevel })
    }


    this.applyLookupInc(justInfo, decompLookup, 1)



    return false
  }

  applyLookupInc(justInfo: JustInfo, lookup: Lookup, nbLevels: number): Boolean {

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
    let layout = justInfo.layoutResult[wordIndex]

    let regExprs = Array.isArray(lookup.regExprs) ? lookup.regExprs : [lookup.regExprs]

    let matched = false

    for (let regIndex = 0; regIndex < regExprs.length && !matched; regIndex++) {

      const regExpr = regExprs[regIndex]
      regExpr.lastIndex = 0

      let match = regExpr.exec(wordInfo.text);

      if (!match) continue

      const groups = match?.indices?.groups

      if (lookup.matchingCondition) {
        if (!lookup.matchingCondition({ justInfo, wordIndex, groups })) continue;
      }

      matched = true


      if (lookup.condition) {
        if (!lookup.condition({ justInfo, wordIndex, groups })) return;
      }

      let tempResult = new Map(result)


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
            newFeatures = action.apply({ prevFeatures, char: wordInfo.text[group[0]], wordIndex, charIndex: group[0] })
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
      paragraph.dispose()
      if (wordNewWidth != layout.parWidth && justInfo.textLineWidth + wordNewWidth - layout.parWidth < justInfo.desiredWidth) {
        justInfo.textLineWidth += wordNewWidth - layout.parWidth
        layout.parWidth = wordNewWidth
        justInfo.fontFeatures = tempResult
        result = tempResult
      }
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

    let paragraphBuilder = this.paraBuilder
    paragraphBuilder.reset()
    paragraphBuilder.pushStyle(this.textStyle);


    //let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, this.fontMgr).pushStyle(this.textStyle);

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

    //paragraphBuilder.dispose()

    return paragraph
  }

  matchingCondition(context: LookupContext) {
    const wordInfos = this.lineTextInfo.wordInfos;
    const wordInfo = wordInfos[context.wordIndex]

    if (wordInfo.baseText.length == 2 && !"سش".includes(wordInfo.baseText)) {
      return false
    }

    let k3 = context?.groups?.["k3"]
    let k4 = context?.groups?.["k4"] || context?.groups?.["k5"]
    if (k3 && k4) {
      const wordInfo = wordInfos[context.wordIndex]
      const chark3 = wordInfo.text[k3[0]]
      const chark4 = wordInfo.text[k4[0]]
      const indexk3InLine = k3[0] + wordInfo.startIndex
      const prevk3Features = context.justInfo.fontFeatures.get(indexk3InLine)
      if (chark3 == "ل" && (chark4 == "ك" || chark4 == "د" || chark4 == "ذ")) {
        return false
      } else if ("عغجحخ".includes(chark3) && !prevk3Features?.find(a => a.name == "cv16") && ("كلذداة".includes(chark4) || (chark4 === "ه" && quranTextService.isLastBase(wordInfo.text, k4[0])))) {
        return false
      }
    }
    return true
  }
  static async saveLayout(fontSizeLineWidthRatio: number, fontMgr: SkTypefaceFontProvider) {

    const result: JustResultByLine[][] = []

    for (let pageIndex = 0; pageIndex < quranTextService.quranText.length; pageIndex++) {
      //for (let pageIndex = 0; pageIndex < 10; pageIndex++) {      

      result.push(await JustService.getPageLayout(pageIndex, fontSizeLineWidthRatio, fontMgr))
      console.log(`pageIndex=${pageIndex} saved`)
    }

    JustService.saveLayoutToStorage(fontSizeLineWidthRatio, result)
  }
  static async getPageLayout(pageIndex: number, fontSizeLineWidthRatio: number, fontMgr: SkTypefaceFontProvider) {

    const paraBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);

    const result: JustResultByLine[] = []

    for (let lineIndex = 0; lineIndex < quranTextService.quranText[pageIndex].length; lineIndex++) {
      const lineInfo = quranTextService.getLineInfo(pageIndex, lineIndex)
      const lineTextInfo = quranTextService.analyzeText(pageIndex, lineIndex)
      let justResult: JustResultByLine
      if (lineInfo.lineType === 1 || (lineInfo.lineType === 2 && pageIndex != 0 && pageIndex != 1)) {
        justResult = { fontFeatures: new Map(), simpleSpacing: SPACEWIDTH, ayaSpacing: SPACEWIDTH, fontSizeRatio: 1 }
        result.push(justResult)

      } else {
        // simple line

        let lineWidthRatio = 1

        if (lineInfo.lineWidthRatio !== 1) {

          lineWidthRatio = lineInfo.lineWidthRatio

        }

        let justService: JustService = new JustService(pageIndex, lineIndex, lineTextInfo, fontMgr, fontSizeLineWidthRatio, lineWidthRatio, paraBuilder)
        justResult = justService.justifyLine()
        result.push(justResult)

      }

    }

    paraBuilder.dispose()

    return result;
  }


  static saveLayoutToStorage(fontSizeLineWidthRatio: number, result: JustResultByLine[][]) {
    localStorage.setItem("layout" + fontSizeLineWidthRatio, compress(JSON.stringify(result, replacer)))
    cachedLayouts.set(fontSizeLineWidthRatio, result)

  }

  static getLayoutFromStorage(fontSizeLineWidthRatio: number): JustResultByLine[][] | undefined {

    let layout = cachedLayouts.get(fontSizeLineWidthRatio)
    if (layout) {
      return layout
    } else {
      const json = localStorage.getItem("layout" + fontSizeLineWidthRatio)
      if (json) {
        layout = JSON.parse(decompress(json), reviver)
        if (layout) {
          cachedLayouts.set(fontSizeLineWidthRatio, layout)
        }
        
      }
      return layout
    }
  }

  static removeLayouts(fontSizeLineWidthRatio?: number) {
    Object.keys(localStorage)
      .filter(x =>
        fontSizeLineWidthRatio ? "layout" + fontSizeLineWidthRatio : x.startsWith('layout'))
      .forEach(x =>
        localStorage.removeItem(x))
  }


}

function replacer(key: any, value: any) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}

function reviver(key: any, value: any) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

let cachedLayouts:  Map<number,JustResultByLine[][]> = new Map()