const integrations = [
  { id: 'meta', label: 'Meta', variables: ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'] },
  { id: 'youtube', label: 'YouTube', variables: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] },
  { id: 'tiktok', label: 'TikTok', variables: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'] }
];

export function GET() {
  return Response.json(
    {
      integrations: integrations.map(({ id, label, variables }) => ({
        id,
        label,
        configured: variables.every((name) => Boolean(process.env[name])),
        missingVariables: variables.filter((name) => !process.env[name])
      }))
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } }
  );
}

