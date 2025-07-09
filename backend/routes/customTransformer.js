const express = require('express');
const router = express.Router();
const CustomTransformer = require('../models/CustomTransformer');
const DataSource = require('../models/DataSource');

// Create new custom transformer
router.post('/', async (req, res) => {
  try {
    const transformer = new CustomTransformer(req.body);
    await transformer.save();
    res.status(201).json(transformer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all custom transformers
router.get('/', async (req, res) => {
  try {
    const transformers = await CustomTransformer.find().populate('dataSourceId', 'name provider');
    res.json(transformers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get custom transformers by data source
router.get('/datasource/:dataSourceId', async (req, res) => {
  try {
    const transformers = await CustomTransformer.find({ 
      dataSourceId: req.params.dataSourceId 
    }).populate('dataSourceId', 'name provider');
    res.json(transformers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single custom transformer
router.get('/:id', async (req, res) => {
  try {
    const transformer = await CustomTransformer.findById(req.params.id)
      .populate('dataSourceId', 'name provider format');
    if (!transformer) return res.status(404).json({ error: 'Not found' });
    res.json(transformer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update custom transformer
router.put('/:id', async (req, res) => {
  try {
    const transformer = await CustomTransformer.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, version: { $inc: 1 } }, 
      { new: true }
    );
    if (!transformer) return res.status(404).json({ error: 'Not found' });
    res.json(transformer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete custom transformer
router.delete('/:id', async (req, res) => {
  try {
    const transformer = await CustomTransformer.findByIdAndDelete(req.params.id);
    if (!transformer) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test custom transformer
router.post('/:id/test', async (req, res) => {
  try {
    const transformer = await CustomTransformer.findById(req.params.id)
      .populate('dataSourceId', 'name provider format');
    
    if (!transformer) {
      return res.status(404).json({ error: 'Transformer not found' });
    }

    // Sample data for testing
    const sampleData = {
      csv: [
        { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, city: 'New York', country: 'USA' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, city: 'London', country: 'UK' }
      ],
      json: {
        products: [
          { id: 1, name: 'Laptop Pro', category: 'Electronics', price: 1299.99, stock: 45, rating: 4.5 },
          { id: 2, name: 'Wireless Headphones', category: 'Audio', price: 199.99, stock: 120, rating: 4.2 }
        ]
      },
      xml: {
        orders: {
          order: [
            {
              $: { id: '1001', customer_id: 'C001', date: '2024-01-15' },
              customer: { name: 'John Smith', email: 'john.smith@email.com' },
              total: '81.96'
            }
          ]
        }
      }
    };

    const testData = sampleData[transformer.dataSourceId.format] || [];
    
    // Test transformer
    let transformedData;
    try {
      // eslint-disable-next-line no-new-func
      const transformFunction = new Function('data', transformer.transformerCode);
      transformedData = transformFunction(testData);
    } catch (err) {
      return res.status(400).json({ 
        error: 'Transformer execution failed', 
        details: err.message 
      });
    }

    // Test mapping
    let mappedData;
    try {
      if (transformer.mappingConfig.mode === 'direct') {
        mappedData = transformedData.map(item => {
          const mapped = {};
          Object.entries(transformer.mappingConfig.rules).forEach(([target, source]) => {
            mapped[target] = item[source];
          });
          return mapped;
        });
      } else if (transformer.mappingConfig.mode === 'expression') {
        mappedData = transformedData.map(item => {
          const mapped = {};
          Object.entries(transformer.mappingConfig.rules).forEach(([target, expr]) => {
            try {
              // eslint-disable-next-line no-new-func
              mapped[target] = Function('row', `return (${expr})`)(item);
            } catch (err) {
              mapped[target] = `Error: ${err.message}`;
            }
          });
          return mapped;
        });
      }
    } catch (err) {
      return res.status(400).json({ 
        error: 'Mapping execution failed', 
        details: err.message 
      });
    }

    // Update test results
    await CustomTransformer.findByIdAndUpdate(req.params.id, {
      'metadata.lastTested': new Date(),
      'metadata.testResults': {
        success: true,
        inputCount: testData.length,
        outputCount: mappedData.length,
        timestamp: new Date()
      }
    });

    res.json({
      success: true,
      input: testData,
      transformed: transformedData,
      mapped: mappedData,
      summary: {
        inputCount: testData.length,
        transformedCount: transformedData.length,
        mappedCount: mappedData.length
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 