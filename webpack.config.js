/* eslint-env node */
/* eslint @typescript-eslint/no-var-requires: "off" */

const path = require("path");

const HTMLWebpackPlugin = require("html-webpack-plugin");
const MonacoEditorWebpackPlugin = require("monaco-editor-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: process.env.NODE_ENV,
  devtool: process.env.NODE_ENV === "development" ? "inline-source-map" : undefined,
  entry: "./src/index.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "output.bundle.js"
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.ttf$/,
        type: "asset/resource"
      },
      {
        test: /\.wasm$/,
        type: "asset/resource",
      },
      {
          test: /\.(pack|br|a)$/,
          type: "asset/resource",
      },
      {
        test: /\.ts$|\.m?js$|\.jsx$|\.tsx$/,
        exclude: /node_modules/,
        use: {
          loader: "swc-loader"
        }
      }
    ]
  },
  plugins: [
    new HTMLWebpackPlugin({ template: './index.html' }),
    new MonacoEditorWebpackPlugin({ languages: [ "python", "cpp" ]}),
    new CopyPlugin({
      patterns: [
        { from: 'lib/pyodide', to: 'lib/pyodide' },
        {
          from: "lib/emception/brotli/brotli.wasm",
          to: "brotli/brotli.wasm"
        },
        {
          from: "lib/emception/wasm-package/wasm-package.wasm",
          to: "wasm-package/wasm-package.wasm"
        }
      ]
    })
  ],
  resolve: {
    alias: {
      emception: "/lib/emception",
    },
    fallback: {
      url: false,
      "llvm-box.wasm": false,
      "binaryen-box.wasm": false,
      "python.wasm": false,
      "quicknode.wasm": false,
      "path": false,
      "node-fetch": false,
      "vm": false
    },
    extensions: [
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".mjs"
    ]
  },
  devServer: {
    static: {
      directory: path.join(__dirname),
    },
    hot: true,
    allowedHosts: "all",
    port: "auto",
    server: "https",
    headers: {
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
    }
  }
};