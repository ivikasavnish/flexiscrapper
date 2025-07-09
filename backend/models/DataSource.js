const mongoose = require('mongoose');

const DataSourceSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  name: { type: String, required: true },
  method: { type: String, required: true },
  url: { type: String, required: true },
  headers: { type: Object, default: {} },
  body: { type: String, default: '' },
  cron: { type: String, required: true },
  retry: { type: Number, default: 0 },
  mapping: { type: Object, default: {} },
  format: { type: String, enum: ['csv', 'tsv', 'json', 'xml'], required: true },
  pagination: { type: Object, default: {} },
  stopCondition: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DataSource', DataSourceSchema); 