const express = require('express');
const router = express.Router();
const DataSource = require('../models/DataSource');

// Create new data source
router.post('/', async (req, res) => {
  try {
    const ds = new DataSource(req.body);
    await ds.save();
    res.status(201).json(ds);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all data sources
router.get('/', async (req, res) => {
  try {
    const sources = await DataSource.find();
    res.json(sources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single data source
router.get('/:id', async (req, res) => {
  try {
    const ds = await DataSource.findById(req.params.id);
    if (!ds) return res.status(404).json({ error: 'Not found' });
    res.json(ds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update data source
router.put('/:id', async (req, res) => {
  try {
    const ds = await DataSource.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ds) return res.status(404).json({ error: 'Not found' });
    res.json(ds);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete data source
router.delete('/:id', async (req, res) => {
  try {
    const ds = await DataSource.findByIdAndDelete(req.params.id);
    if (!ds) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 