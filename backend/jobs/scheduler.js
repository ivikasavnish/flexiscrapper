const cron = require('node-cron');
const DataSource = require('../models/DataSource');
const { fetchAndParse, getJobState, updateJobState } = require('../utils/fetchAndParse');
const { v4: uuidv4 } = require('uuid');

const scheduledJobs = {};
const activeJobs = new Map();

async function runJob(source) {
  const jobId = uuidv4();
  console.log(`Starting job ${jobId} for source: ${source.name}`);
  
  try {
    // Add to active jobs
    activeJobs.set(jobId, {
      sourceId: source._id,
      sourceName: source.name,
      startTime: Date.now(),
      status: 'running'
    });

    // Run the job with progress tracking
    const results = await fetchAndParse({
      url: source.url,
      method: source.method,
      headers: source.headers,
      body: source.body,
      format: source.format,
      pagination: source.pagination,
      stopCondition: source.stopCondition,
      jobId: jobId,
      onProgress: (progress) => {
        console.log(`Job ${jobId} progress: ${progress.progress}% (${progress.currentPage}/${progress.totalPages})`);
      }
    });

    // Process results with transformers and mappers
    let processedResults = results;
    
    // Apply transformers
    if (source.transformers && source.transformers.length > 0) {
      for (const transformer of source.transformers) {
        if (transformer.type === 'custom' && transformer.customFunction) {
          try {
            // eslint-disable-next-line no-new-func
            const transformFn = Function('data', transformer.customFunction);
            processedResults = transformFn(processedResults);
          } catch (error) {
            console.error(`Error applying custom transformer: ${error.message}`);
          }
        }
      }
    }

    // Apply mappers
    if (source.mappers && source.mappers.length > 0) {
      for (const mapper of source.mappers) {
        if (mapper.type === 'direct') {
          processedResults = processedResults.map(item => {
            const mapped = {};
            Object.keys(mapper.mapping).forEach(key => {
              mapped[key] = item[mapper.mapping[key]];
            });
            return mapped;
          });
        } else if (mapper.type === 'expression' && mapper.expression) {
          try {
            // eslint-disable-next-line no-new-func
            const mapFn = Function('item', `return ${mapper.expression}`);
            processedResults = processedResults.map(item => mapFn(item));
          } catch (error) {
            console.error(`Error applying expression mapper: ${error.message}`);
          }
        }
      }
    }

    // Store results in MongoDB (you might want to create a separate model for this)
    console.log(`Job ${jobId} completed successfully. Processed ${processedResults.length} records.`);
    
    // Update job status
    activeJobs.set(jobId, {
      ...activeJobs.get(jobId),
      status: 'completed',
      endTime: Date.now(),
      resultsCount: processedResults.length
    });

  } catch (error) {
    console.error(`Job ${jobId} failed:`, error.message);
    
    // Update job status
    activeJobs.set(jobId, {
      ...activeJobs.get(jobId),
      status: 'error',
      endTime: Date.now(),
      error: error.message
    });
  }
}

async function loadAndScheduleJobs() {
  // Clear existing jobs
  Object.values(scheduledJobs).forEach(job => job.stop());
  Object.keys(scheduledJobs).forEach(key => delete scheduledJobs[key]);

  // Load all data sources
  const sources = await DataSource.find();
  sources.forEach(source => {
    if (source.cron && cron.validate(source.cron)) {
      const job = cron.schedule(source.cron, () => runJob(source), {
        scheduled: true
      });
      scheduledJobs[source._id] = job;
      console.log(`Scheduled job for source: ${source.name} with cron: ${source.cron}`);
    }
  });
}

function getActiveJobs() {
  return Array.from(activeJobs.entries()).map(([jobId, job]) => ({
    jobId,
    ...job,
    state: getJobState(jobId)
  }));
}

function getJobById(jobId) {
  const job = activeJobs.get(jobId);
  if (!job) return null;
  
  return {
    jobId,
    ...job,
    state: getJobState(jobId)
  };
}

module.exports = { 
  loadAndScheduleJobs, 
  scheduledJobs, 
  runJob,
  getActiveJobs,
  getJobById,
  activeJobs
}; 