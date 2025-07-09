const mongoose = require('mongoose');

const CustomTransformerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  dataSourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource', required: true },
  transformerCode: { type: String, required: true },
  mappingConfig: { type: Object, required: true },
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  tags: [{ type: String }],
  metadata: {
    createdBy: { type: String, default: 'user' },
    lastTested: { type: Date },
    testResults: { type: Object }
  }
}, { timestamps: true });

module.exports = mongoose.model('CustomTransformer', CustomTransformerSchema); 