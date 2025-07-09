const axios = require('axios');
const { parse } = require('csv-parse/sync');
const xml2js = require('xml2js');
const _ = require('lodash');

// Global job state management
const jobStates = new Map();

function getJobState(jobId) {
  if (!jobStates.has(jobId)) {
    jobStates.set(jobId, {
      status: 'running', // running, paused, stopped, completed, error
      progress: 0,
      totalPages: 0,
      currentPage: 0,
      results: [],
      error: null,
      startTime: Date.now(),
      lastUpdate: Date.now()
    });
  }
  return jobStates.get(jobId);
}

function updateJobState(jobId, updates) {
  const state = getJobState(jobId);
  Object.assign(state, updates, { lastUpdate: Date.now() });
  return state;
}

function stopJob(jobId) {
  const state = getJobState(jobId);
  state.status = 'stopped';
  state.lastUpdate = Date.now();
  return state;
}

function pauseJob(jobId) {
  const state = getJobState(jobId);
  state.status = 'paused';
  state.lastUpdate = Date.now();
  return state;
}

function resumeJob(jobId) {
  const state = getJobState(jobId);
  state.status = 'running';
  state.lastUpdate = Date.now();
  return state;
}

async function fetchAndParse({ 
  url, 
  method, 
  headers, 
  body, 
  format, 
  pagination = {}, 
  stopCondition = '',
  jobId = null,
  onProgress = null
}) {
  let results = [];
  let page = pagination.start || 1;
  let maxPages = pagination.maxPages || 1;
  let hasNext = true;
  let nextPageCursor = null;
  let requestUrl = url;
  let requestBody = body;
  let totalProcessed = 0;

  // Initialize job state if jobId provided
  if (jobId) {
    updateJobState(jobId, {
      status: 'running',
      progress: 0,
      totalPages: maxPages,
      currentPage: page,
      results: [],
      error: null,
      startTime: Date.now()
    });
  }

  for (let i = 0; i < maxPages && hasNext; i++) {
    // Check if job should be stopped or paused
    if (jobId) {
      const state = getJobState(jobId);
      if (state.status === 'stopped') {
        console.log(`Job ${jobId} stopped by user`);
        break;
      }
      
      if (state.status === 'paused') {
        console.log(`Job ${jobId} paused, waiting for resume...`);
        while (state.status === 'paused') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (state.status === 'stopped') {
            console.log(`Job ${jobId} stopped while paused`);
            break;
          }
        }
        if (state.status === 'stopped') break;
      }
    }

    try {
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

      // Ensure parsed is an array
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      results = results.concat(parsed);
      totalProcessed += parsed.length;

      // Update job state
      if (jobId) {
        const progress = Math.min(100, ((i + 1) / maxPages) * 100);
        updateJobState(jobId, {
          progress,
          currentPage: page,
          results: results.length
        });

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            jobId,
            progress,
            currentPage: page,
            totalPages: maxPages,
            totalResults: results.length,
            lastBatchSize: parsed.length
          });
        }
      }

      // Stop condition
      if (stopCondition) {
        try {
          // eslint-disable-next-line no-new-func
          const stop = Function('response', 'page', 'results', 'totalProcessed', `return (${stopCondition})`)(response, page, results, totalProcessed);
          if (stop) {
            console.log(`Job ${jobId} stopped by condition: ${stopCondition}`);
            break;
          }
        } catch (error) {
          console.error(`Error evaluating stop condition: ${error.message}`);
        }
      }

      // Next page/cursor
      if (pagination.nextPagePath) {
        nextPageCursor = _.get(response.data, pagination.nextPagePath, null);
        if (!nextPageCursor) {
          hasNext = false;
        }
      } else {
        page++;
      }

      // Add delay between requests to be respectful
      if (i < maxPages - 1 && hasNext) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message);
      
      if (jobId) {
        updateJobState(jobId, {
          status: 'error',
          error: error.message
        });
      }
      
      throw error;
    }
  }

  // Mark job as completed
  if (jobId) {
    updateJobState(jobId, {
      status: 'completed',
      progress: 100,
      currentPage: page
    });
  }

  return results;
}

// Export job management functions
module.exports = {
  fetchAndParse,
  getJobState,
  updateJobState,
  stopJob,
  pauseJob,
  resumeJob,
  jobStates
}; 