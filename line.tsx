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
import { JustInfo, JustResultByLine, JustService } from './just.service'

type LineProps = {
  pageWidth: number;
  pageIndex: number;
  lineIndex: number;
  fontSize: number,
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

  let fontSize = props.fontSize;

  const lineInfo = quranTextService.getLineInfo(pageIndex, lineIndex)

  const scale = pageWidth / PAGE_WIDTH;

  let margin = MARGIN * scale;

  let lineWidth = pageWidth - 2 * margin;

  const fontSizeLineWidthRatio = fontSize / lineWidth

  const lineTextInfo = quranTextService.analyzeText(pageIndex, lineIndex)



  const cachedLayout = JustService.getLayoutFromStorage(fontSizeLineWidthRatio)

  let justResult = cachedLayout && cachedLayout?.[pageIndex] && cachedLayout[pageIndex][lineIndex]


  if (lineInfo.lineType === 1 || (lineInfo.lineType === 2 && pageIndex != 0 && pageIndex != 1)) {
    if (!justResult) {
      justResult = { fontFeatures: new Map(), simpleSpacing: SPACEWIDTH, ayaSpacing: SPACEWIDTH, fontSizeRatio: 1 }
    }
  } else {
    // simple line

    let lineWidthRatio = 1

    if (lineInfo.lineWidthRatio !== 1) {

      lineWidthRatio = lineInfo.lineWidthRatio
      const newlineWidth = lineWidth * lineInfo.lineWidthRatio
      margin += (lineWidth - newlineWidth) / 2

    }

    if (!justResult) {
      let justService: JustService = new JustService(pageIndex, lineIndex, lineTextInfo, fontMgr, fontSizeLineWidthRatio, lineWidthRatio)
      justResult = justService.justifyLine()
    }
  }


  return getLine(pageIndex, lineIndex, fontMgr, justResult, pageWidth, fontSize, margin, props.yPos)
};

function getLine(pageIndex: number, lineIndex: number, fontMgr: any, justResult: JustResultByLine, pageWidth: number, fontSize: number, margin: number, yPos: number) {

  const scale = (fontSize * justResult.fontSizeRatio) / FONTSIZE

  const pageText = quranTextService.quranText[pageIndex]

  const lineInfo = quranTextService.getLineInfo(pageIndex, lineIndex)

  const lineText = pageText[lineIndex]

  const tajweedInfo = quranTextService.getTajweed(pageIndex, lineIndex)

  const lineTextInfo = quranTextService.analyzeText(pageIndex, lineIndex)


  const textStyle: SkTextStyle = {
    color: Skia.Color("black"),
    fontFamilies: ["oldmadina"],
    fontSize: justResult.fontSizeRatio * fontSize,

  };

  if (lineInfo.lineType === 2 && pageIndex != 0 && pageIndex != 1) {
    textStyle.fontFeatures = [{ name: "basm", value: 1 }]
  }

  let paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);

  paragraphBuilder.pushStyle(textStyle);
  for (let wordIndex = 0; wordIndex < lineTextInfo.wordInfos.length; wordIndex++) {

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
      const justInfo = justResult.fontFeatures.get(i)
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
      newtextStyle.letterSpacing = (justResult.ayaSpacing - SPACEWIDTH) * scale
    } else if (lineTextInfo.spaces.get(wordInfo.endIndex + 1) === SpaceType.Simple) {
      newtextStyle.letterSpacing = (justResult.simpleSpacing - SPACEWIDTH) * scale
    }

    paragraphBuilder.pushStyle(newtextStyle)
    paragraphBuilder.addText(" ")
    paragraphBuilder.pop()
  }



  const maxWidth = pageWidth * 2;

  paragraphBuilder.pop();
  let paragraph = paragraphBuilder.build();
  paragraph.layout(maxWidth)
  const currLineWidth = paragraph.getLongestLine()


  if (lineInfo.lineType === 1 || (lineInfo.lineType === 2 && pageIndex != 0 && pageIndex != 1)) {
    margin = (pageWidth - currLineWidth) / 2
  }

  const xPos = - (maxWidth - pageWidth + margin)

  paragraphBuilder.dispose()

  return (
    <Paragraph paragraph={paragraph} x={xPos} y={yPos} width={maxWidth} />
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