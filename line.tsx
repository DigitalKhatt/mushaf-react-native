import React, { useState } from 'react';
import { Button, View, StyleSheet, ScrollView } from 'react-native';
import {
  Paragraph, Skia, useFonts, TextAlign, Canvas, Circle, Group, useFont, Text, TextBlob, Rect, TextHeightBehavior,
  SkTextFontFeatures,
  SkParagraphStyle,
  TextDirection,
  SkTextStyle,
  SkRect
} from "@shopify/react-native-skia";
import { quranTextService, PAGE_WIDTH, FONTSIZE, MARGIN, INTERLINE, TOP, SPACEWIDTH, SpaceType, LineTextInfo } from './qurantext.service'
import { JustInfo, JustService } from './just.service'

type LineProps = {
  pageWidth: number;
  pageIndex: number;
  lineIndex: number;
  yPos: number;
};

const lineParStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL
};

const Line = (props: LineProps) => {

  const fontMgr = useFonts({
    oldmadina: [require("./oldmadina.otf")]
  });

  if (!fontMgr) {
    return null;
  }

  const pageIndex = props.pageIndex;

  const lineIndex = props.lineIndex;

  const pageText = quranTextService.quranText[pageIndex]

  const pageWidth = props.pageWidth

  const scale = pageWidth / PAGE_WIDTH;

  let fontSize = FONTSIZE * scale;

  const defaultMargin = MARGIN * scale

  let margin = defaultMargin;

  let lineWidth = pageWidth - 2 * margin;

  const interLine = INTERLINE * scale

  const pageHeight = 15 * interLine + (400 * scale);

  const maxWidth = 2 * lineWidth

  const defaultSpaceWidth = SPACEWIDTH * scale

  const spaceWidthInFont = 100 * scale

  const lineText = pageText[lineIndex]

  const lineInfo = quranTextService.getLineInfo(pageIndex, lineIndex)

  const tajweedInfo = quranTextService.getTajweed(pageIndex, lineIndex)

  const lineTextInfo = quranTextService.analyzeText(pageIndex, lineIndex)

  if (lineInfo.lineType === 1) {
    //sura name : center

    const lineTextStyle = {
      color: Skia.Color("black"),
      fontFamilies: ["oldmadina"],
      fontSize: fontSize,
    };
    let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr).pushStyle(lineTextStyle);
    paragraphBuilder.addText(lineText)
    let paragraph = paragraphBuilder.pop().build();
    paragraph.layout(maxWidth);
    const parHeight = paragraph.getHeight();
    const parWidth = paragraph.getLongestLine();

    const xPos = -(maxWidth - parWidth) + (pageWidth - parWidth) / 2;

    return (
      <Paragraph style="fill" paragraph={paragraph} x={xPos} y={props.yPos} width={maxWidth} />
    );

  } else if (lineInfo.lineType === 2 && pageIndex != 0 && pageIndex != 1) {
    //basmala : center

    const lineTextStyle = {
      color: Skia.Color("black"),
      fontFamilies: ["oldmadina"],
      fontSize: fontSize,
      fontFeatures: [{ name: "basm", value: 1 }]
    };

    let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr).pushStyle(lineTextStyle);
    paragraphBuilder.addText(lineText)
    let paragraph = paragraphBuilder.pop().build();
    paragraph.layout(maxWidth);
    const parHeight = paragraph.getHeight();
    const parWidth = paragraph.getLongestLine();
   

    const xPos = -(maxWidth - parWidth) + (pageWidth - parWidth) / 2;

    return (
      <Paragraph style="fill" paragraph={paragraph} x={xPos} y={props.yPos} width={maxWidth} />
    );
  } else {
    // simple line

    if (lineInfo.lineWidthRatio !== 1) {

      const newlineWidth = lineWidth * lineInfo.lineWidthRatio
      margin += (lineWidth - newlineWidth) / 2
      lineWidth = newlineWidth
    }

    

    const lineTextStyle = {
      color: Skia.Color("black"),
      fontFamilies: ["oldmadina"],
      fontSize: fontSize
    };

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

      let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr).pushStyle(lineTextStyle);
      paragraphBuilder.addText(wordInfo.text)
      let paragraph = paragraphBuilder.pop().build();
      paragraph.layout(maxWidth);
      const parHeight = paragraph.getHeight();
      const parWidth = paragraph.getLongestLine();

      textWidthByWord += parWidth

      layOutResult.push({
        paragraph,
        parHeight,
        parWidth,
      })

    }

    let getTextWidth = function () {
      const lineParStyle2: SkParagraphStyle = {
        textHeightBehavior: TextHeightBehavior.DisableAll,
        textDirection: TextDirection.RTL
      };
      let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle2, fontMgr).pushStyle(lineTextStyle);
      paragraphBuilder.addText(lineText)
      let paragraph = paragraphBuilder.pop().build();
      paragraph.layout(maxWidth);
      const parHeight = paragraph.getHeight();
      const parWidth = paragraph.getLongestLine();
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

    let diff = lineWidth - currentLineWidth

    if (diff > 0) {
      // stretch   

      let maxStretchBySpace = defaultSpaceWidth * 0.5;
      let maxStretchByAyaSpace = defaultSpaceWidth * 2;

      let maxStretch = maxStretchBySpace * lineTextInfo.simpleSpaceIndexes.length + maxStretchByAyaSpace * lineTextInfo.ayaSpaceIndexes.length;

      let stretch = Math.min(lineWidth - currentLineWidth, maxStretch);
      let spaceRatio = maxStretch != 0 ? stretch / maxStretch : 0;
      let stretchBySpace = spaceRatio * maxStretchBySpace;
      let stretchByByAyaSpace = spaceRatio * maxStretchByAyaSpace;

      simpleSpaceWidth = defaultSpaceWidth + stretchBySpace
      ayaSpaceWidth = defaultSpaceWidth + stretchByByAyaSpace

      currentLineWidth += stretch

      // stretching
      
      if (lineWidth > currentLineWidth) {
        const lineTextStyle: SkTextStyle = {
          fontFamilies: ["oldmadina"],
          fontSize: fontSize,
        }
        let justService: JustService = new JustService(pageIndex, lineIndex, lineTextInfo, fontMgr, currentLineWidth, lineWidth, lineTextStyle, layOutResult)
        justResults = justService.justifyLine()
        currentLineWidth = justResults.textLineWidth
      }



      if (lineWidth > currentLineWidth) {
        // full justify with space
        let addToSpace = (lineWidth - currentLineWidth) / lineTextInfo.spaces.size
        simpleSpaceWidth += addToSpace
        ayaSpaceWidth += addToSpace
      }


    } else {
      //shrink
      const ratio = lineWidth / currentLineWidth;
      // TODO : add shrinking features to the font
      //shrink by changing font size for now 
      fontSize = fontSize * ratio
      simpleSpaceWidth = defaultSpaceWidth * ratio
      ayaSpaceWidth = defaultSpaceWidth * ratio

    }
      
    return lineParagraph(pageWidth, defaultMargin, fontSize, layOutResult, lineTextInfo, fontMgr, lineText, tajweedInfo, justResults,
      maxWidth, ayaSpaceWidth, simpleSpaceWidth, interLine, props.yPos, scale, margin, defaultSpaceWidth)

  }
};

function lineParagraph(pageWidth: number, defaultMargin: number, fontSize: number, layOutResult: any[], lineTextInfo: any, fontMgr: any,
  lineText: string, tajweedInfo: any, justResults: any, maxWidth: number, ayaSpaceWidth: number, simpleSpaceWidth: number,
  interLine: number, yPos: number, scale: number, margin: number, defaultSpaceWidth:number) {

  
  const textStyle: SkTextStyle = {
    color: Skia.Color("black"),
    fontFamilies: ["oldmadina"],
    fontSize: fontSize,
  };

  let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
  
  paragraphBuilder.pushStyle(textStyle);
  for (let wordIndex = 0; wordIndex < layOutResult.length; wordIndex++) {
    const layOut = layOutResult[wordIndex];
    const wordInfo = lineTextInfo.wordInfos[wordIndex]

    
    /*
    if (lineTextInfo.spaces.get(wordInfo.endIndex + 1) === SpaceType.Aya) {
      textStyle.wordSpacing = ayaSpaceWidth - defaultSpaceWidth
    } else {
      textStyle.wordSpacing = simpleSpaceWidth - defaultSpaceWidth
    }

    paragraphBuilder.pushStyle(textStyle)*/

    for (let i = wordInfo.startIndex; i <= wordInfo.endIndex; i++) {
      const char = lineText.charAt(i)
      const tajweed = tajweedInfo.get(i)
      const justInfo = justResults?.fontFeatures?.get(i)
      if (tajweed || justInfo) {

        const newtextStyle: SkTextStyle = {
          ...textStyle
        };

        if (tajweed) {
          newtextStyle.color = Skia.Color(Float32Array.from(getColor(tajweed).map(a => a / 255)))
        }

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

    const newtextStyle: SkTextStyle = {
      ...textStyle
    };

    if (lineTextInfo.spaces.get(wordInfo.endIndex + 1) === SpaceType.Aya) {
      newtextStyle.letterSpacing = ayaSpaceWidth - defaultSpaceWidth  
    } else if (lineTextInfo.spaces.get(wordInfo.endIndex + 1) === SpaceType.Simple) {
      newtextStyle.letterSpacing = simpleSpaceWidth - defaultSpaceWidth
    }
      
    paragraphBuilder.pushStyle(newtextStyle)
    paragraphBuilder.addText(" ")
    paragraphBuilder.pop()
  }
  
  paragraphBuilder.pop();
  let paragraph = paragraphBuilder.build();
  paragraph.layout(maxWidth)
  const currLineWidth = paragraph.getLongestLine()

  //const xStart = pageWidth - margin - currLineWidth
  const xStart = - (maxWidth - currLineWidth) + margin
 
  return (
    <Paragraph paragraph={paragraph} x={xStart} y={yPos} width={maxWidth} />
  );
 
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'column',
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: "rgb(153, 153, 153)",
    alignContent: 'flex-start'
  }
});

function getColor(className: string) {
  switch (className) {
    case "green": return [0, 166, 80];
    case "tafkim": return [0, 102, 148];
    case "lgray": return [156, 154, 155];
    case "lkalkala": return [0, 173, 239];
    case "red1": return [195, 138, 8];
    case "red2": return [244, 114, 22]
    case "red3": return [236, 0, 140]
    case "red4": return [140, 0, 0]
    default: return [0, 0, 0]
  }
}


export default Line;