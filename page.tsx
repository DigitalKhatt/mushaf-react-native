import React, { useState } from 'react';
import { Button, View, StyleSheet, ScrollView } from 'react-native';
import { Paragraph, Skia, useFonts, TextAlign, Canvas, Circle, Group, useFont, Text, TextBlob, Rect, TextHeightBehavior } from "@shopify/react-native-skia";
import { quranTextService, PAGE_WIDTH, FONTSIZE, MARGIN, INTERLINE, TOP } from './qurantext.service'
import Line from './line';


type PageProps = {
  pageWidth: number;
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

  const scale = pageWidth / PAGE_WIDTH;

  const margin = MARGIN * scale;

  const interLine = INTERLINE * scale

  const pageHeight = 15 * interLine + (300 * scale);

  let paddintTop = TOP * scale

  var lineList = [];

  for (let lineIndex = 0; lineIndex < quranTextService.quranText[pageIndex].length; lineIndex++) {
    lineList.push(     
        <Line key={lineIndex}  pageWidth={pageWidth} pageIndex={pageIndex} lineIndex={lineIndex} />      
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={{ width: pageWidth, height: pageHeight, paddingTop: paddintTop}}>
        {lineList}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: {   
    backgroundColor: "rgb(255, 255, 255)",
  },
});


export default Page;