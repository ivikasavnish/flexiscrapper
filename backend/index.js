const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const { loadAndScheduleJobs } = require('./jobs/scheduler');
const fetchAndParse = require('./utils/fetchAndParse');
const transformData = require('./transformers/transformer');

async function jobRunner(dataSource) {
  try {
    const parsedData = await fetchAndParse(dataSource);
    const mappedData = transformData(parsedData, dataSource.mapping);
    console.log(`Transformed data for ${dataSource.name}:`, mappedData);
    // TODO: store mappedData
  } catch (err) {
    console.error(`Job failed for ${dataSource.name}:`, err.message);
  }
}

mongoose.connection.once('open', async () => {
  await loadAndScheduleJobs(jobRunner);
  console.log('Scheduler loaded');
});

// Routes placeholder
app.use('/api/datasources', require('./routes/datasource'));

app.get('/', (req, res) => {
  res.send('FlexiScrapper Backend Running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
