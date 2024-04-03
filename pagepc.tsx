import React, { useState } from 'react';
import { Button, View, StyleSheet, ScrollView } from 'react-native';
import { Paragraph, Skia, useFonts, TextAlign, Canvas, Circle, Group, useFont, Text, TextBlob, Rect, TextHeightBehavior, SkCanvas, SkPaint, useCanvasRef, Image, SkiaPictureView, createPicture, PaintStyle, BlendMode, Path } from "@shopify/react-native-skia";
import { quranTextService, PAGE_WIDTH, FONTSIZE, MARGIN, INTERLINE } from './qurantext.service'
import Line from './line';
import { PreCalulatedLayout, usePreCalulatedLayout } from './precalculated.service';


type PageProps = {
  pageWidth: number;
  fontSize: number;
  index: number;
};

const PagePC = (props: PageProps) => {

  const preCalulatedLayout = usePreCalulatedLayout();
  const ref = useCanvasRef();

  if (!preCalulatedLayout) {
    return null;
  }

  const pageIndex = props.index;

  const pageWidth = props.pageWidth

  const scale = pageWidth / PAGE_WIDTH;

  const margin = MARGIN * scale;

  const interLine = INTERLINE * scale

  const pageHeight = 15 * interLine + (300 * scale);



  let yPos = -200 * scale;

  let paint: SkPaint = Skia.Paint()
  paint.setStyle(PaintStyle.Fill);
  paint.setAntiAlias(true)
  //paint.setBlendMode(BlendMode.Multiply);

  /*
  const paths = preCalulatedLayout.getOutlines(58173, 0, 0)

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Canvas style={{ width: pageWidth, height: pageHeight }}>
        <Path path={paths[0].path} transform={[{ translateX: pageWidth - 3000 * scale }, { translateY: 800 * scale },{ scaleX: scale }, { scaleY: -scale }]}>
        </Path>
      </Canvas>
    </ScrollView>
  );*/

  
  
  const pagePicture = createPicture((canvas) => {
    canvas.clear(Skia.Color("transparent"));
    drawPage(preCalulatedLayout, canvas, paint, props.index, pageWidth)
  })  

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SkiaPictureView style={{ width: pageWidth, height: pageHeight }} picture={pagePicture} />
    </ScrollView>
  );



};

function drawPage(preCalulatedLayout: PreCalulatedLayout, canvas: SkCanvas, paint: SkPaint, pageIndex: number, pageWidth: number) {
  const fontSizeScale: number = 1.0;

  const scale: number = pageWidth / (17000)

  const x_start: number = pageWidth - 400 * scale

  const inter_line = INTERLINE * scale

  let y_start = inter_line * 0.72


  if (pageIndex === 0 || pageIndex === 1) {
    y_start = y_start + 3.5 * inter_line
  }

  const page = preCalulatedLayout.getPage(pageIndex)

  for (let l = 0; l < page.getLinesList().length; l++) {

    const line = page.getLinesList()[l]

    canvas.save()

    const x = x_start - line.getX() * scale

    canvas.translate(x, y_start + l * inter_line)

    canvas.scale(scale, -scale)


    for (const glyph of line.getGlyphsList()) {

      canvas.translate(-glyph.getXAdvance(), 0.0)
      canvas.translate(glyph.getXOffset(), glyph.getYOffset())

      const paths = preCalulatedLayout.getOutlines(glyph.getCodepoint(), glyph.getLefttatweel(), glyph.getRighttatweel())

      let glyphColor = Skia.Color("black")

      if (glyph.hasColor()) {
        const color = glyph.getColor()
        const red = (color >> 24) & 0xff
        const green = (color >> 16) & 0xff
        const blue = (color >> 8) & 0xff

        glyphColor = Float32Array.from([red / 255, green / 255, blue / 255])
      }


      for (const path of paths) {
        const color = path.color
        if (color) {
          paint.setColor(color)
        } else {
          paint.setColor(glyphColor)
        }
        canvas.drawPath(path.path, paint)
      }


      canvas.translate(-glyph.getXOffset(), -glyph.getYOffset())
    }

    canvas.restore()
  }
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "rgb(255, 255, 255)",
  },
});



export default PagePC;