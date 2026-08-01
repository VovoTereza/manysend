import { encryptToken, metaConfig, readOAuthState, upsertSocialAccounts } from '../../../server/meta-oauth.js';

function panelRedirect(request, status, reason = '') {
  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
  const params = new URLSearchParams({ integration: 'meta', status });
  if (reason) params.set('reason', reason);
  return Response.redirect(`${appUrl}/?${params}`, 302);
}

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  if (query.get('error')) return panelRedirect(request, 'error', query.get('error_reason') || 'access_denied');
  try {
    const state = readOAuthState(query.get('state'));
    const code = query.get('code');
    if (!code) throw new Error('missing_code');
    const config = metaConfig();
    const tokenParams = new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code
    });
    const tokenResponse = await fetch(`https://graph.facebook.com/${config.version}/oauth/access_token?${tokenParams}`, {
      headers: { Accept: 'application/json' }
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error?.message || 'token_exchange_failed');

    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.appId,
      client_secret: config.appSecret,
      fb_exchange_token: token.access_token
    });
    const longResponse = await fetch(`https://graph.facebook.com/${config.version}/oauth/access_token?${longParams}`);
    const longToken = await longResponse.json();
    const userToken = longResponse.ok && longToken.access_token ? longToken.access_token : token.access_token;
    const fields = 'id,name,username,access_token,tasks,instagram_business_account{id,name,username,profile_picture_url,followers_count}';
    const accountResponse = await fetch(`https://graph.facebook.com/${config.version}/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userToken)}`);
    const accountData = await accountResponse.json();
    if (!accountResponse.ok) throw new Error(accountData.error?.message || 'account_discovery_failed');
    const now = new Date().toISOString();
    const records = [];
    for (const page of accountData.data || []) {
      if (!page.access_token) continue;
      const tokenCiphertext = encryptToken(page.access_token);
      records.push({
        platform: 'facebook', external_account_id: page.id, display_name: page.name,
        username: page.username || null, status: 'connected', permissions: page.tasks || [],
        token_ciphertext: tokenCiphertext, metadata: { connected_by: state.userId },
        last_synced_at: now, updated_at: now
      });
      if (page.instagram_business_account) {
        const instagram = page.instagram_business_account;
        records.push({
          platform: 'instagram', external_account_id: instagram.id,
          display_name: instagram.name || instagram.username, username: instagram.username || null,
          status: 'connected', permissions: ['instagram_basic','pages_show_list','pages_read_engagement'],
          token_ciphertext: tokenCiphertext,
          metadata: { facebook_page_id: page.id, profile_picture_url: instagram.profile_picture_url || null, followers_count: instagram.followers_count ?? null, connected_by: state.userId },
          last_synced_at: now, updated_at: now
        });
      }
    }
    if (!records.length) throw new Error('no_managed_pages_found');
    await upsertSocialAccounts(records);
    return panelRedirect(request, 'connected');
  } catch (error) {
    return panelRedirect(request, 'error', error.message);
  }
}
