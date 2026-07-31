const requiredGroups = {
  core: ['APP_URL', 'SESSION_SECRET', 'TOKEN_ENCRYPTION_KEY', 'DATABASE_URL'],
  meta: ['META_APP_ID', 'META_APP_SECRET', 'META_VERIFY_TOKEN', 'META_REDIRECT_URI'],
  youtube: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI']
};

function groupStatus(keys) {
  const configured = keys.filter((key) => Boolean(process.env[key]));
  return {
    ready: configured.length === keys.length,
    configured: configured.length,
    required: keys.length,
    missing: keys.filter((key) => !process.env[key])
  };
}

export function GET() {
  const services = Object.fromEntries(
    Object.entries(requiredGroups).map(([name, keys]) => [name, groupStatus(keys)])
  );
  const ready = Object.values(services).every((service) => service.ready);

  return Response.json(
    {
      status: ready ? 'ready' : 'configuration_required',
      service: 'manysend-api',
      environment: process.env.VERCEL_ENV || 'development',
      deployment: process.env.VERCEL_URL || 'localhost',
      services,
      timestamp: new Date().toISOString()
    },
    {
      status: ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    }
  );
}

