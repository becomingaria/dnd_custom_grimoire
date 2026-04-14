/**
 * Amplify v6 configuration.
 * Values are injected from the VITE_ environment variables set after CDK deployment.
 */
const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId:       import.meta.env.VITE_USER_POOL_ID as string,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID as string,
      loginWith: {
        email: true,
      },
    },
  },
};

export default awsConfig;
