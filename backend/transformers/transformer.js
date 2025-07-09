function transformData(data, mapping) {
  if (!mapping || !mapping.mode || !mapping.rules) {
    throw new Error('Invalid mapping configuration');
  }
  const { mode, rules } = mapping;
  if (mode === 'direct') {
    // Direct field mapping
    return data.map(row => {
      const mapped = {};
      for (const [target, source] of Object.entries(rules)) {
        mapped[target] = row[source];
      }
      return mapped;
    });
  } else if (mode === 'expression') {
    // Expression-based mapping
    return data.map(row => {
      const mapped = {};
      for (const [target, expr] of Object.entries(rules)) {
        // eslint-disable-next-line no-new-func
        mapped[target] = Function('row', `return (${expr})`)(row);
      }
      return mapped;
    });
  } else {
    throw new Error('Unsupported mapping mode: ' + mode);
  }
}

module.exports = transformData; 