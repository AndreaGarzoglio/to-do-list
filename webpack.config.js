const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'docs'),
        },
        compress: true,
        port: process.env.PORT || 8080,
    },
};
