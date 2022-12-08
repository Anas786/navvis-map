const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs')
const ESLintPlugin = require("eslint-webpack-plugin");

const plugins = [
	new HtmlWebpackPlugin({
		template: "src/index.html",
		favicon: "src/assets/image/favicon.ico"
	}),
	new CopyWebpackPlugin([{
		from: "./src/js/components/sidebar-menu-dashboard/sidebar-menu-dashboard.html",
		to: ""
	}])
];

if (fs.existsSync('../../../.eslintrc.js'))
{
	plugins.push(new ESLintPlugin({
			extensions: [".ts"],
			emitWarning: true,
			emitError: true,
			failOnWarning: true,
		})
	);
}

module.exports = {
	entry: './src/js/index',
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/
			},
			{
				// Pack images (e.g. when importing a dependency's css)
				test: /\.(jpe?g|png|gif|svg|ico)$/,
				use: [
					'file-loader?name=[hash].[name].[ext]',
					'image-webpack-loader?bypassOnDebug'
				]
			},
			{
				// SCSS: Compile to CSS, inject CSS in index.html (style-loader)
				test: /\.scss$/,
				use: ['style-loader', 'css-loader?sourceMap', 'sass-loader?sourceMap']
			}
		]
	},
	resolve: {
		extensions: ['.ts', '.js']
	},
	plugins,
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist')
	},
	devtool: 'inline-source-map',
	devServer: {
		contentBase: './dist'
	},
	mode: 'development'
};
