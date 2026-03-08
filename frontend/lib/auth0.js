import { initAuth0 } from '@auth0/nextjs-auth0';

const auth0 = initAuth0({
  secret: process.env.AUTH0_SECRET,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  baseURL: process.env.APP_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

export default auth0;
