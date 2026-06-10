const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');

process.env.USE_BLOB_DB = '1';
process.env.NETLIFY = 'true';

let handlerPromise;

function initNetlifyBlobs(event) {
  if (event?.blobs) {
    connectLambda(event);
    return;
  }
  const siteID =
    process.env.SITE_ID ||
    process.env.NETLIFY_SITE_ID ||
    event?.headers?.['x-nf-site-id'];
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    const { setEnvironmentContext } = require('@netlify/blobs');
    setEnvironmentContext({ siteID, token });
  }
}

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { createApiApp } = await import('../../server/src/app-api.js');
      const app = await createApiApp();
      return serverless(app, {
        binary: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });
    })();
  }
  return handlerPromise;
}

exports.handler = async (event, context) => {
  initNetlifyBlobs(event);
  const handler = await getHandler();
  return handler(event, context);
};