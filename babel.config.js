module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        test: /\.tsx?$/,
        plugins: [['@babel/plugin-transform-typescript', { allowDeclareFields: true, isTSX: true }]],
      },
    ],
  };
};