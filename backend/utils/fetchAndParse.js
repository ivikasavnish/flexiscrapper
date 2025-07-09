const axios = require('axios');
const { parse } = require('csv-parse/sync');
const xml2js = require('xml2js');
const _ = require('lodash');

async function fetchAndParse({ url, method, headers, body, format, pagination = {}, stopCondition = '' }) {
  let results = [];
  let page = pagination.start || 1;
  let maxPages = pagination.maxPages || 1;
  let hasNext = true;
  let nextPageCursor = null;
  let requestUrl = url;
  let requestBody = body;

  for (let i = 0; i < maxPages && hasNext; i++) {
    // Build request for this page
    let reqConfig = {
      url: requestUrl,
      method: method || 'GET',
      headers: headers || {},
      data: requestBody || undefined,
      responseType: 'text',
      timeout: 30000,
    };
    // Add page/cursor param if needed
    if (pagination.type === 'query' && pagination.param) {
      const u = new URL(requestUrl);
      u.searchParams.set(pagination.param, nextPageCursor || page);
      reqConfig.url = u.toString();
    } else if (pagination.type === 'body' && pagination.param) {
      let b = requestBody ? JSON.parse(requestBody) : {};
      b[pagination.param] = nextPageCursor || page;
      reqConfig.data = JSON.stringify(b);
    }
    // Fetch
    const response = await axios(reqConfig);
    let raw = response.data;
    // Parse
    let parsed;
    if (format === 'json') {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } else if (format === 'csv' || format === 'tsv') {
      parsed = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        delimiter: format === 'tsv' ? '\t' : ',',
      });
    } else if (format === 'xml') {
      parsed = await xml2js.parseStringPromise(raw, { explicitArray: false });
    } else {
      throw new Error('Unsupported format: ' + format);
    }
    // Extract list if needed
    if (pagination.responseListPath) {
      parsed = _.get(parsed, pagination.responseListPath, parsed);
    }
    results = results.concat(parsed);
    // Stop condition
    if (stopCondition) {
      // eslint-disable-next-line no-new-func
      const stop = Function('response', 'page', `return (${stopCondition})`)(response, page);
      if (stop) break;
    }
    // Next page/cursor
    if (pagination.nextPagePath) {
      nextPageCursor = _.get(response.data, pagination.nextPagePath, null);
      if (!nextPageCursor) hasNext = false;
    } else {
      page++;
    }
  }
  return results;
}

module.exports = fetchAndParse; 