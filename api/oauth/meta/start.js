import { authenticatedUser, createOAuthState, metaConfig, noStoreJson } from '../../../server/meta-oauth.js';

export async function GET(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return noStoreJson({ error: 'unauthorized' }, 401);
    const config = metaConfig();
    const state = createOAuthState({ userId: user.id, provider: 'meta' });
    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      auth_type: 'rerequest'
    });
    if (process.env.META_LOGIN_CONFIG_ID?.trim()) {
      params.set('config_id', process.env.META_LOGIN_CONFIG_ID.trim());
      params.set('override_default_response_type', 'true');
    } else {
      params.set('scope', ['pages_show_list','pages_read_engagement','instagram_basic'].join(','));
    }
    return noStoreJson({ authorizationUrl: `https://www.facebook.com/${config.version}/dialog/oauth?${params}` });
  } catch (error) {
    return noStoreJson({ error: 'configuration_required', detail: error.message }, 503);
  }
}
