import {
  Frame, Layout, Page
} from "@shopify/polaris";
import axios from "axios";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";

const Index = () => {

  const getOrder = async() => {
  const data =  await axios.get('/api/get-order');
  console.log(data);
  }

  useEffect(() => {getOrder()},[]);


  const a = '32w4c';
  console.log(a.split('w'));

  return (
    <Frame>
      <Page
      >
        <Layout>
          <Layout.Section>
            Home page
          </Layout.Section>
        </Layout>

      </Page>


    </Frame>
  );
};

export default Index;
