import React, { } from 'react';
import {
  View,
} from "react-native";

import Page from './page';
import PagePC from './pagepc';

const pageType = [
  Page,
  PagePC,
];

type PageProps = {
  type: number,
  pageWidth: number;
  fontSize: number;
  index: number;
};

const PageFactory = (props: PageProps) => {

  const FactoryOutput = pageType[props.type - 1];

  return (
    <FactoryOutput
      pageWidth={props.pageWidth}
      fontSize={props.fontSize}
      index={props.index}
    />
  );
}

export default PageFactory;