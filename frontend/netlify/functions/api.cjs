exports.handler = async (event) => {
  const apiOrigin = process.env.API_ORIGIN;
  if (!apiOrigin) {
    return { statusCode: 503, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'API_ORIGIN is not configured for the Netlify API proxy' }) };
  }

  try {
    const incomingUrl = new URL(event.rawUrl || `https://netlify.local${event.path}`);
    const apiPath = incomingUrl.pathname.replace(/^\/.netlify\/functions\/api/, '/api');
    const target = new URL(`${apiPath}${incomingUrl.search}`, apiOrigin);
    const headers = { ...event.headers };
    for (const name of Object.keys(headers)) {
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(name.toLowerCase())) delete headers[name];
    }

    const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for']?.split(',')[0]?.trim();
    if (clientIp) headers['x-forwarded-for'] = clientIp;

    const body = event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
      : undefined;
    const upstream = await fetch(target, {
      method: event.httpMethod,
      headers,
      body: ['GET', 'HEAD'].includes(event.httpMethod) ? undefined : body,
      redirect: 'manual'
    });

    const responseHeaders = {};
    upstream.headers.forEach((value, name) => {
      if (!['set-cookie', 'content-encoding', 'content-length', 'transfer-encoding'].includes(name.toLowerCase())) {
        responseHeaders[name] = value;
      }
    });
    const setCookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []);

    const responseBytes = Buffer.from(await upstream.arrayBuffer());
    return {
      statusCode: upstream.status,
      headers: responseHeaders,
      multiValueHeaders: setCookies.length ? { 'Set-Cookie': setCookies } : undefined,
      body: responseBytes.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ error: 'The API service could not be reached' })
    };
  }
};
