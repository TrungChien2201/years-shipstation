import "@babel/polyfill";
import dotenv from "dotenv";
import "isomorphic-fetch";
import createShopifyAuth, { verifyRequest } from "@shopify/koa-shopify-auth";
import Shopify, { ApiVersion, DataType } from "@shopify/shopify-api";
import Koa from "koa";
import next from "next";
import Router from "koa-router";
import Shop from "../models/shop.model"

import {
  storeCallback,
  loadCallback,
  deleteCallback,
} from "../utilities/redis-store";
import axios from "axios";

const _ = require("lodash");
const mongoose = require("mongoose");
const bodyParser = require("koa-bodyparser");
const cors = require("@koa/cors");
const fs = require('fs');
dotenv.config();

mongoose
  .connect(process.env.MONGODB_URL, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => {
    if (process.env.NODE_ENV !== "test") {
      console.log(
        "Connected to %s",
        "mongodb://127.0.0.1:27017/solodrop"
      );
    }
  });


const path = require("path");
const serve = require("koa-static");
const port = parseInt(process.env.PORT, 10) || 8081;
const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
});
const handle = app.getRequestHandler();

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES
    ? process.env.SCOPES.split(",")
    : "read_content,write_content,read_script_tags,write_script_tags,read_products,read_themes",
  HOST_NAME: process?.env?.HOST?.replace(/https:\/\//, ""),
  API_VERSION: "2022-01",
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(
    storeCallback,
    loadCallback,
    deleteCallback
  ),
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};

if (process.env.NODE_ENV == "development") {
  ACTIVE_SHOPIFY_SHOPS["chienvu-store.myshopify.com"] = "access_token";
}

app.prepare().then(async () => {
  const server = new Koa();
  const router = new Router();
  server.keys = [Shopify.Context.API_SECRET_KEY];
  server.use(
    createShopifyAuth({
      accessMode: "offline",
      async afterAuth(ctx) {
        // Access token and shop available in ctx.state.shopify
        const { shop, accessToken, scope } = ctx.state.shopify;
        const host = ctx.query.host;
        ACTIVE_SHOPIFY_SHOPS[shop] = scope;

        await Shop.findOneAndUpdate(
          { shop: shop },
          {
            shop: shop,
            token: accessToken,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Redirect to app with shop parameter upon auth
        ctx.redirect(`/?shop=${shop}&host=${host}`);
      },
    })
  );

  async function getOrderDetail(orderId) {
    const { data } = await axios({
      method: 'get', url: `https://${process.env.SHOP}/admin/api/2023-01/orders/${orderId}.json`, headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_API_SECRET
      }
    });

    const diliveryDate = data?.order?.note_attributes?.find(attr => attr.name === '__deliveryDate')?.value;
    const productBundle = data?.order?.line_items?.filter(v => v.sku.toLowerCase().includes('w') && v.sku.toLowerCase().includes('g')) || [];
    const packSize = productBundle?.map(v => v?.sku?.split('W')[1]?.toLowerCase().replace('g', '')).join(' + ');
    const dogs = productBundle?.length === 1 ? '1 Dog' : productBundle?.length > 1 ? productBundle?.length + ' Dogs' : '';
    const customerId = data?.order?.customer?.id;
    // const cs = await getCustomerMetafields(customerId);
    // console.log(cs, 'cs');
    let customerInfo;

    const response = {
      diliveryDate,
      packSize,
      dogs,
      productBundle: productBundle.map(v => ({ name: v.name, sku: v.sku, bundleSize: v?.sku?.split('W')[1]?.toLowerCase().replace('g', ''), title: v.title, })),
      order: data?.order?.name,
      id: data?.order?.id,
      orderType: data?.order?.tags?.includes('Subscription First Order') ? 'First Order' : 'Recurring Order'
    };
    console.log(response);
    return response;
  }



  const handleRequest = async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  };

  const verifyIfActiveShopifyShop = async (ctx, next) => {
    let { shop } = ctx.query;
    shop = "chienvu-store.myshopify.com";
    const shopData = await Shop.findOne({ shop });

    // This shop hasn't been seen yet, go through OAuth to create a session
    // if (ACTIVE_SHOPIFY_SHOPS[shop] === undefined || !shopData) {
    //   ctx.redirect(`/auth?shop=${shop}`);
    //   return;
    // }

    return next();
  };

  router.get("/", verifyIfActiveShopifyShop, async (ctx) => {
    await handleRequest(ctx);
    // const data = await getOrderDetail('4424964866105');
    return;
  });

  async function getCustomerMetafields(customerId) {
    const rs = await axios({
      method: 'get',
      url: `https://${process.env.SHOP}/admin/api/2023-01/customers/${customerId}/metafields.json`,
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_API_SECRET
      }
    });

    let metafield = rs.data.metafields.find((mf) => {
      return mf.key == "quiz_dogs";
    });
    console.log(rs);
    return rs;

  }

  router.get("/api/get-order", bodyParser(), async (ctx) => {
    try {
      const data = await getOrderDetail('4424521646137');
      console.log(data);
      ctx.status = 200;
      ctx.body = { data };
    } catch (error) {
      ctx.status = 200;
      ctx.body = { error };
    }


  });

  router.post("/webhooks", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post("/webhooks/customers/redact", async (ctx) => {
    ctx.status = 200;
  });

  router.post("/webhooks/shop/redact", async (ctx) => {
    ctx.status = 200;
  });

  router.post("/webhooks/customers/data_request", async (ctx) => {
    ctx.status = 200;
  });

  router.post(
    "/graphql",
    verifyRequest({ returnHeader: true }),
    async (ctx, next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res);
    }
  );


  router.get("(/_next/static/.*)", handleRequest); // Static content is clear
  router.get("/_next/webpack-hmr", handleRequest); // Webpack content is clear
  router.get("(.*)", verifyIfActiveShopifyShop, handleRequest);

  const staticDirPath = path.join(process.cwd(), "public");
  server.use(serve(staticDirPath));
  server.use(router.allowedMethods());
  server.use(router.routes());
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
