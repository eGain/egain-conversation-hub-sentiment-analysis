const NodeCache = require('node-cache');

const egGlobalCache = new NodeCache({ stdTTL: 0 });

module.exports = { egGlobalCache };
