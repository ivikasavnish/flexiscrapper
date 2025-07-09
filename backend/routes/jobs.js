const express = require('express');
const router = express.Router();
const { getActiveJobs, getJobById, runJob } = require('../jobs/scheduler');
const { stopJob, pauseJob, resumeJob, getJobState } = require('../utils/fetchAndParse');
const DataSource = require('../models/DataSource');

// Get all active jobs
router.get('/', async (req, res) => {
  try {
    const jobs = getActiveJobs();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific job by ID
router.get('/:jobId', async (req, res) => {
  try {
    const job = getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start a new job for a data source
router.post('/start/:sourceId', async (req, res) => {
  try {
    const source = await DataSource.findById(req.params.sourceId);
    if (!source) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    // Start the job asynchronously
    runJob(source);
    
    res.json({ message: 'Job started successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop a job
router.post('/:jobId/stop', async (req, res) => {
  try {
    const job = getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    stopJob(req.params.jobId);
    res.json({ message: 'Job stopped successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pause a job
router.post('/:jobId/pause', async (req, res) => {
  try {
    const job = getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    pauseJob(req.params.jobId);
    res.json({ message: 'Job paused successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resume a job
router.post('/:jobId/resume', async (req, res) => {
  try {
    const job = getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    resumeJob(req.params.jobId);
    res.json({ message: 'Job resumed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get job state
router.get('/:jobId/state', async (req, res) => {
  try {
    const state = getJobState(req.params.jobId);
    if (!state) {
      return res.status(404).json({ error: 'Job state not found' });
    }
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 