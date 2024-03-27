import { SkCanvas, SkColor, SkPaint, SkPath, Skia } from "@shopify/react-native-skia";
import { Platform } from "react-native";

const quran = require('./quran_pb.js');

import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from "react";

interface GlyphOutline {
  path: SkPath;
  color?: SkColor;
}

export class PreCalulatedLayout {

  private _font: proto.protobuf.Font;
  private _layout: proto.protobuf.LayOut;
  constructor(font: proto.protobuf.Font, layout: proto.protobuf.LayOut) {

    this._font = font
    this._layout = layout

  }

  getPage(pageIndex: number) {
    return this._layout.getPagesList()[pageIndex]
  }

  getOutlines(codepoint: number, _lefttatweel: number, _righttatweel: number): GlyphOutline[] {
    let outlines: GlyphOutline[] = []

    const glyphInfo: proto.protobuf.Glyph = this._font.getGlyphsMap().get(codepoint)
    const limits = glyphInfo.getLimitsList().length != 4 ? [0, 0, 0, 0] : glyphInfo.getLimitsList()
    const lefttatweel = _lefttatweel < limits[0] ? limits[0] : (_lefttatweel > limits[1] ? limits[1] : _lefttatweel)
    const righttatweel = _righttatweel < limits[2] ? limits[2] : (_righttatweel > limits[3] ? limits[3] : _righttatweel)


    var leftScalar = 0.0;
    if (lefttatweel < 0) {
      leftScalar = lefttatweel / limits[0];
    } else if (lefttatweel > 0) {
      leftScalar = lefttatweel / limits[1];
    }
    var rightScalar = 0.0;
    if (righttatweel < 0) {
      rightScalar = righttatweel / limits[2];
    } else if (righttatweel > 0) {
      rightScalar = righttatweel / limits[3];
    }

    const interpolate = (value: number, i: number, j: number, k: number): number => {
      var interpolatedValue = value;
      if (lefttatweel < 0) {
        interpolatedValue += (glyphInfo.getMinleftList()[i].getElemsList()[j].getPointsList()[k] - value) * leftScalar;
      } else if (lefttatweel > 0) {
        interpolatedValue += (glyphInfo.getMaxleftList()[i].getElemsList()[j].getPointsList()[k] - value) * leftScalar;
      }
      if (righttatweel < 0) {
        interpolatedValue += (glyphInfo.getMinrightList()[i].getElemsList()[j].getPointsList()[k] - value) * rightScalar;
      } else if (righttatweel > 0) {
        interpolatedValue += (glyphInfo.getMaxrightList()[i].getElemsList()[j].getPointsList()[k] - value) * rightScalar;
      }

      return interpolatedValue

    }

    for (let i = 0; i < glyphInfo.getDefaultList().length; i++) {

      const defaultPath = glyphInfo.getDefaultList()[i]

      const path = Skia.Path.Make();

      for (let j = 0; j < defaultPath.getElemsList().length; j++) {
        const elems = defaultPath.getElemsList()[j]
        const pointsList = elems.getPointsList()
        if (pointsList.length === 2) {
          path.moveTo(interpolate(pointsList[0], i, j, 0), interpolate(pointsList[1], i, j, 1));
        } else if (pointsList.length === 6) {
          path.cubicTo(interpolate(pointsList[0], i, j, 0), interpolate(pointsList[1], i, j, 1), interpolate(pointsList[2], i, j, 2),
            interpolate(pointsList[3], i, j, 3), interpolate(pointsList[4], i, j, 4), interpolate(pointsList[5], i, j, 5));
        }
      }

      var color: SkColor | undefined;
      const colorList = defaultPath.getColorList()
      if (colorList.length == 3) {

        const red = colorList[0]
        const green = colorList[1]
        const blue = colorList[2]

        color = Float32Array.from([red / 255, green / 255, blue / 255])
      }

      outlines.push({ path, color })
    }

    return outlines
  }

}

let globalPreCalulatedLayout: PreCalulatedLayout | undefined
export const usePreCalulatedLayout = () => {
  const [preCalulatedLayout, setPreCalulatedLayout] = useState<null | PreCalulatedLayout>(null);

  useEffect(() => {

    if (globalPreCalulatedLayout) {
      setPreCalulatedLayout(globalPreCalulatedLayout)
      return
    }

    let font: proto.protobuf.Font
    let layout: proto.protobuf.LayOut;

    fetch('./font.protobuf')
      .then(response => response.blob())
      .then(blob => {
        let reader = new FileReader();
        reader.addEventListener("loadend", () => {
          font = proto.protobuf.Font.deserializeBinary(reader.result)
          if (font && layout) {
            globalPreCalulatedLayout = new PreCalulatedLayout(font, layout)
            setPreCalulatedLayout(globalPreCalulatedLayout)
          }
        });
        reader.readAsArrayBuffer(blob);
      });

    fetch('./layout.protobuf')
      .then(response => response.blob())
      .then(blob => {
        let reader = new FileReader();
        reader.addEventListener("loadend", () => {
          layout = proto.protobuf.LayOut.deserializeBinary(reader.result)
          if (font && layout) {
            globalPreCalulatedLayout = new PreCalulatedLayout(font, layout)
            setPreCalulatedLayout(globalPreCalulatedLayout)
          }
        });
        reader.readAsArrayBuffer(blob);
      });
  }, []);
  return preCalulatedLayout;
};