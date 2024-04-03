import React, { useState } from 'react';
import { Button, View, StyleSheet, ScrollView } from 'react-native';
import { Skia, useFonts, TextAlign, Canvas, Circle, Group, useFont, Text, TextBlob, Rect, TextHeightBehavior } from "@shopify/react-native-skia";
import { quranTextService, PAGE_WIDTH, FONTSIZE, MARGIN, INTERLINE } from './qurantext.service'
import Line from './line';


type PageProps = {
  pageWidth: number;
  fontSize: number,
  index: number;
};

const Page = (props: PageProps) => {

  const fontMgr = useFonts({
    oldmadina: [require("./oldmadina.otf")]
  });

  if (!fontMgr) {
    return null;
  }

  const pageIndex = props.index;

  const pageWidth = props.pageWidth

  const fontSize = props.fontSize

  const scale = pageWidth / PAGE_WIDTH;

  const margin = MARGIN * scale;

  const interLine = INTERLINE * scale

  const pageHeight = 15 * interLine + (300 * scale);

  var lineList = [];

  const ascendant = 400 * (fontSize / FONTSIZE)

  let yPos = -ascendant + 200 * scale;


  for (let lineIndex = 0; lineIndex < quranTextService.quranText[pageIndex].length; lineIndex++) {
    if ((pageIndex === 0 || pageIndex == 1) && lineIndex == 1) {
      yPos = 3 * interLine;
    }
    lineList.push(
      <Line key={lineIndex} pageWidth={pageWidth} pageIndex={pageIndex} lineIndex={lineIndex} yPos={yPos} fontSize={fontSize} />
    );
    yPos += interLine;
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Canvas style={{ width: pageWidth, height: pageHeight }}>
        {lineList}
      </Canvas>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "rgb(255, 255, 255)",
  },
});


export default Page;