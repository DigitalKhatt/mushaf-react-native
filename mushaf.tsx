import { useMemo, useState } from "react";
import { Paragraph, Skia, useFonts, TextAlign, Canvas, Circle, Group, useFont, Text, TextBlob, Rect, center } from "@shopify/react-native-skia";
import { StyleSheet, View, Button, Alert, TextInput } from 'react-native';
import Page from "./page";



const fontSize = 30
const scale = fontSize / 1000
let defaultPageWidth = scale * 17000
const margin = scale * 400
const lineWidth = defaultPageWidth - 2 * margin

const Mushaf = () => {  

  const [pageWidth, setPageWidth] = useState(defaultPageWidth);
  const [pageIndex, setPageIndex] = useState(2);
  

  return (
    <View style={styles.container}>
      <View style={styles.fixToText}>
        <TextInput         
          value={(pageIndex+1).toString()}     
          style={styles.pageNumberInput}
          keyboardType="numeric"
          onChangeText={(text)=>{
            const textasNumber  = Number(text)
            if(textasNumber >= 1 && textasNumber <= 604){
              setPageIndex(textasNumber - 1)
            }
          }}
        />
        <Button
          title="<-"
          onPress={() => setPageIndex(pageIndex == 0 ? 603 : pageIndex - 1)}
        />
        <Button
          title="->"
          onPress={() => setPageIndex(pageIndex == 603 ? 0 : pageIndex + 1)}
        />
        <Button
          title="-"
          onPress={() => setPageWidth(pageWidth*1/1.2)}
        />
        <Button
          title="+"
          onPress={() => setPageWidth(pageWidth * 1.2)}
        />
      </View>
      <Page pageWidth={pageWidth} index={pageIndex}/>      
    </View>
  );
  

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgb(153, 153, 153)", 
  },
  fixToText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: "center",
  },
  pageNumberInput: {
    width:50,
    height: 35,
    padding: 5,
    borderWidth: 1,
    backgroundColor: "rgb(33, 150, 243)",
    textAlign:"center",
    color: "#ffffffff"
  },
});



export default Mushaf;