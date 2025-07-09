const cron = require('node-cron');
const DataSource = require('../models/DataSource');

const scheduledJobs = {};

async function loadAndScheduleJobs(jobRunner) {
  // Clear existing jobs
  Object.values(scheduledJobs).forEach(job => job.stop());
  Object.keys(scheduledJobs).forEach(key => delete scheduledJobs[key]);

  // Load all data sources
  const sources = await DataSource.find();
  sources.forEach(source => {
    if (cron.validate(source.cron)) {
      const job = cron.schedule(source.cron, () => jobRunner(source), {
        scheduled: true
      });
      scheduledJobs[source._id] = job;
    }
  });
}

module.exports = { loadAndScheduleJobs, scheduledJobs }; 