const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    name: 'todo-app',
    entry: './src/app.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'docs'),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: 'index.html',
        }),
        new CopyWebpackPlugin({
            patterns: [{ from: 'src/static', to: '.' }],
        }),
    ],
    devServer: {
        static: [
            { directory: path.join(__dirname, 'docs') },
            { directory: path.join(__dirname, 'src/static') },
        ],
        compress: true,
        port: process.env.PORT || 8080,
    },
};
