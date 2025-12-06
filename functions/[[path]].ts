// Catch-all route handler for SPA client-side routing
// This ensures all non-API routes serve index.html for React Router
export const onRequest: PagesFunction = async ({ request, next, env }) => {
  const url = new URL(request.url);

  // Let API routes be handled by their specific functions
  if (url.pathname.startsWith('/api/')) {
    return next();
  }

  // Let asset requests go through normally
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff2?|ttf|eot)$/)) {
    return next();
  }

  // For all other routes (SPA navigation), serve index.html
  // This allows React Router to handle the routing client-side
  try {
    const response = await env.ASSETS.fetch(new URL('/index.html', request.url));
    return new Response(response.body, {
      ...response,
      headers: {
        ...Object.fromEntries(response.headers),
        'Content-Type': 'text/html',
      },
    });
  } catch {
    return next();
  }
};
