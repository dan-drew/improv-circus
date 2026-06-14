function getSourceData(data, key) {
  const sourceData = data[key];
  console.assert(sourceData, 'Missing data for %s in 11ty data: %O', key, data);
  if (!sourceData) throw new Error(`Missing data for ${key} in 11ty data`);
  return sourceData;
}

/**
 * Map a factory function to a data object
 * @param {object} data 11ty data object
 * @param {string} key Data key
 * @param {function(string, object, object): object} model
 */
export function mapFactory(data, key, model) {
  return Object.fromEntries(
    Object.entries(getSourceData(data, key)).map(([key, instanceData]) => [key, new model(key, instanceData, data)])
  )
}

/**
 * Map a factory function to a data object
 * @param {object} data 11ty data object
 * @param {string} key Data key
 * @param {function(object, object): object} model
 */
export function listFactory(data, key, model) {
  return getSourceData(data, key).map(instanceData => new model(instanceData, data));
}
