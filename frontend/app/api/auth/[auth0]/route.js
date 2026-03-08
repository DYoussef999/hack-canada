import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

const authHandler = handleAuth({
  login: handleLogin({
    returnTo: '/dashboard',
  }),
});

export async function GET(req, ctx) {
  const params = await ctx.params;
  return authHandler(req, { ...ctx, params });
}
