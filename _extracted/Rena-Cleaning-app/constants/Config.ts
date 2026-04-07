import Constants from 'expo-constants';

const ENV = {
  development: {
    apiUrl: 'http://localhost:3000',
  },
  staging: {
    apiUrl: 'https://staging.renacleaning.co.uk',
  },
  production: {
    apiUrl: 'https://renacleaning.co.uk',
  },
};

type Environment = keyof typeof ENV;

function getEnvironment(): Environment {
  const releaseChannel = Constants.expoConfig?.extra?.releaseChannel;
  if (releaseChannel === 'production') return 'production';
  if (releaseChannel === 'staging') return 'staging';
  return 'development';
}

export const Config = ENV[getEnvironment()];
