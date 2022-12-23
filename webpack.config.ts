import path from 'path';
import DotEnv from 'dotenv-webpack';

export default {
  name: 'production',
  target: 'node',
  entry: path.resolve(__dirname, './src/index.ts'),
  output: {
    path: path.resolve(__dirname, './build'),
    filename: 'fingridbot.js',
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        use: 'ts-loader',
        include: path.resolve(__dirname, './src'),
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    modules: ['node_modules'],
  },
  plugins: [
    new DotEnv({
      path:
        process.env.NODE_ENV === 'development'
          ? path.join(__dirname, '.dev')
          : path.join(__dirname, '.env'),
    }),
  ],
  optimization: {
    minimize: false,
  },
};
