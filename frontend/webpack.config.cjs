const path = require('path');
const webpack = require('webpack');

const { portalConfigDefine, loadPortalConfig } = require('./config/portalConfig.cjs');

// `--env app` (npm run build:web) builds the standalone app; BUILD_APP=1 is still accepted.
module.exports = (env = {}, argv = {}) => {
  const isApp = Boolean(env.app) || process.env.BUILD_APP === '1';
  const isProduction = process.env.NODE_ENV === 'production' && !isApp;
  const optimizeApp = isApp && argv.mode === 'production';

  return {
    plugins: [
      new webpack.DefinePlugin(portalConfigDefine()),
      ...(optimizeApp ? [{
        apply(compiler) {
          compiler.hooks.thisCompilation.tap('PortalEntryManifest', compilation => {
            compilation.hooks.processAssets.tap({ name: 'PortalEntryManifest', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
              const scripts = compilation.entrypoints.get('main').getFiles().filter(file => file.endsWith('.js'));
              compilation.emitAsset('entrypoints.json', new webpack.sources.RawSource(JSON.stringify({ scripts }, null, 2)));
            });
          });
        },
      }] : []),
    ],
    entry: isProduction ? './src/index.tsx' : './src/demo/bootstrap.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      ...(optimizeApp ? { publicPath: loadPortalConfig().publicBasePath } : {}),
      filename: optimizeApp ? '[name].[contenthash:8].js' : isProduction ? 'index.js' : 'main.js',
      chunkFilename: '[id].[contenthash:8].js',
      clean: isApp,
      libraryTarget: isProduction ? 'umd' : undefined,
      library: isProduction ? 'WeaveAiChat' : undefined,
      umdNamedDefine: isProduction,
      globalObject: isProduction ? 'this' : undefined
    },
    ...(optimizeApp ? { optimization: {
      runtimeChunk: 'single',
      splitChunks: { chunks: 'all', minSize: 20 * 1024, maxSize: 180 * 1024, hidePathInfo: true },
    } } : {}),
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-react',
                '@babel/preset-typescript'
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    'tailwindcss',
                    'autoprefixer',
                  ]
                }
              }
            }
          ]
        },
        {
          test: /\.svg$/i,
          issuer: /\.[jt]sx?$/,
          use: [
            {
              loader: '@svgr/webpack',
              options: {
                typescript: true,
                dimensions: false,
                svgo: true,
                svgoConfig: {
                  plugins: [
                    {
                      name: 'preset-default',
                      params: {
                        overrides: {
                          removeViewBox: false,
                          removeUselessStrokeAndFill: false,
                          removeUnknownsAndDefaults: false,
                          cleanupIds: false
                        }
                      }
                    }
                  ]
                }
              }
            }
          ]
        },
      ]
    },
    externals: isProduction ? {
      react: {
        commonjs: 'react',
        commonjs2: 'react',
        amd: 'React',
        root: 'React'
      },
      'react-dom': {
        commonjs: 'react-dom',
        commonjs2: 'react-dom',
        amd: 'ReactDOM',
        root: 'ReactDOM'
      }
    } : {},
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
      },
      port: 8081,
      // Serve index.html for app paths such as /inquiry-document/<id>, as the
      // Netlify and nginx deployments do.
      historyApiFallback: true,
      hot: true,
      open: true,
      client: {
        overlay: {
          errors: true,
          warnings: false,
          runtimeErrors: false,
        },
      },
    }
  };
};
