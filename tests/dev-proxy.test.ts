import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import { accessHeaders, createAoboboDevProxy, isRemote, normalizeTarget } from '../rsbuild.dev-proxy';

beforeEach(() => {
  rstest.spyOn(console, 'info').mockImplementation(() => {});
  rstest.spyOn(console, 'warn').mockImplementation(() => {});
  rstest.spyOn(console, 'error').mockImplementation(() => {});
});

function requestMock(initial: Record<string, unknown> = {}) {
  const headers = { ...initial };
  return {
    headers,
    getHeader: rstest.fn((name) => headers[name]),
    setHeader: rstest.fn((name, value) => { headers[name] = value; }),
  };
}

function responseMock() {
  return { writeHead: rstest.fn(), end: rstest.fn(), destroy: rstest.fn(), destroyed: false, headersSent: false };
}

describe('development proxy targets and credentials', () => {
  it.each([
    [undefined, ''], [null, ''], [false, ''], [123, ''], ['', ''], ['  ', ''],
    [' https://example.com/ ', 'https://example.com'], ['http://localhost:8080/', 'http://localhost:8080'],
    ['wss://example.com/ws/', 'https://example.com/ws'], ['ws://localhost:8080/', 'http://localhost:8080'],
  ])('normalizes target %s', (value, expected) => expect(normalizeTarget(value)).toBe(expected));

  it.each([
    ['', false], ['http://localhost:8080', false], ['https://127.0.0.1:3000', false], ['http://[::1]:8080', false],
    ['https://example.com', true], ['invalid-url', true],
  ])('identifies remote target %s', (value, expected) => expect(isRemote(value)).toBe(expected));

  it('requires both service-token credentials and trims them', () => {
    expect(accessHeaders({})).toEqual({});
    expect(accessHeaders({ CF_ACCESS_CLIENT_ID: 'id' })).toEqual({});
    expect(accessHeaders({ CF_ACCESS_CLIENT_SECRET: 'secret' })).toEqual({});
    expect(accessHeaders({ CF_ACCESS_CLIENT_ID: '  id ', CF_ACCESS_CLIENT_SECRET: ' secret  ', CF_AUTHORIZATION: ' jwt ' })).toEqual({
      'CF-Access-Client-Id': 'id', 'CF-Access-Client-Secret': 'secret', Cookie: 'CF_Authorization=jwt',
    });
    expect(accessHeaders({ CF_ACCESS_CLIENT_ID: ' ', CF_ACCESS_CLIENT_SECRET: 'secret', CF_AUTHORIZATION: ' ' })).toEqual({});
  });
});

describe('development proxy routing', () => {
  it('returns no routes without targets', () => expect(createAoboboDevProxy({})).toEqual({}));

  it('registers the more specific websocket path before API and preserves direct websocket paths', () => {
    const proxy = createAoboboDevProxy({ API_HOST: 'http://localhost:8080/', WS_HOST: 'ws://localhost:8080/' });
    expect(Object.keys(proxy)).toEqual(['/api/v1/ws/server', '/api']);
    expect(proxy['/api/v1/ws/server']).toMatchObject({ target: 'http://localhost:8080', ws: true, selfHandleResponse: false });
    expect(proxy['/api/v1/ws/server'].pathRewrite('/api/v1/ws/server?x=1')).toBe('/api/v1/ws/server?x=1');
    expect(proxy['/api'].selfHandleResponse).toBe(false);
    expect(proxy['/api'].on.proxyRes).toBeUndefined();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('uses the websocket relay only when no Access credentials exist', () => {
    const proxy = createAoboboDevProxy({ WS_HOST: 'wss://upstream.example/ws?key=a', PROXY_WS_HOST: 'ws://localhost:3001/' });
    expect(proxy['/api/v1/ws/server'].target).toBe('http://localhost:3001');
    expect(proxy['/api/v1/ws/server'].pathRewrite('/ignored')).toBe('/proxy?wsPath=wss://upstream.example/ws?key=a');
  });

  it.each([
    { CF_ACCESS_CLIENT_ID: 'id', CF_ACCESS_CLIENT_SECRET: 'secret' },
    { CF_AUTHORIZATION: 'jwt' },
  ])('ignores the relay when Cloudflare Access is configured', (credentials) => {
    const proxy = createAoboboDevProxy({ WS_HOST: 'wss://example.com/', PROXY_WS_HOST: 'ws://localhost:3001', ...credentials });
    expect(proxy['/api/v1/ws/server'].target).toBe('https://example.com');
    expect(proxy['/api/v1/ws/server'].pathRewrite('/api/v1/ws/server')).toBe('/api/v1/ws/server');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ignoring PROXY_WS_HOST'));
  });

  it('logs credential presence without logging secret values', () => {
    createAoboboDevProxy({ API_HOST: 'https://example.com', CF_ACCESS_CLIENT_ID: 'id-private', CF_ACCESS_CLIENT_SECRET: 'secret-private', CF_AUTHORIZATION: 'jwt-private' });
    expect(console.info).toHaveBeenCalledExactlyOnceWith('[aobobo-dev-proxy] remote=on access=on cookie=on');
    expect(JSON.stringify(rstest.mocked(console.info).mock.calls)).not.toContain('private');
  });
});

describe('proxy outgoing headers', () => {
  it('sets service-token headers, appends authorization cookies and rewrites remote Origin', () => {
    const proxy = createAoboboDevProxy({ API_HOST: 'https://example.com/base', CF_ACCESS_CLIENT_ID: 'id', CF_ACCESS_CLIENT_SECRET: 'secret', CF_AUTHORIZATION: 'jwt' });
    const request = requestMock({ cookie: 'session=existing' });
    proxy['/api'].on.proxyReq(request);
    expect(request.headers).toMatchObject({
      cookie: 'session=existing; CF_Authorization=jwt',
      'CF-Access-Client-Id': 'id', 'CF-Access-Client-Secret': 'secret', Origin: 'https://example.com',
    });
  });

  it('sets a cookie on websocket upgrades even when the original request has no cookie', () => {
    const proxy = createAoboboDevProxy({ WS_HOST: 'wss://example.com/ws', CF_AUTHORIZATION: 'jwt' });
    const request = requestMock();
    proxy['/api/v1/ws/server'].on.proxyReqWs(request);
    expect(request.headers).toMatchObject({ cookie: 'CF_Authorization=jwt', Origin: 'https://example.com' });
    expect(proxy['/api/v1/ws/server'].on.proxyRes).toBeUndefined();
  });

  it('preserves local Origin and tolerates an unparseable remote origin', () => {
    const local = createAoboboDevProxy({ API_HOST: 'http://localhost:8080' });
    const request = requestMock({ Origin: 'http://localhost:3000' });
    local['/api'].on.proxyReq(request);
    expect(request.headers.Origin).toBe('http://localhost:3000');
    const invalid = createAoboboDevProxy({ API_HOST: 'invalid' });
    invalid['/api'].on.proxyReq(request);
    expect(request.headers.Origin).toBe('http://localhost:3000');
  });
});

describe('proxy response handling', () => {
  it.each([
    [301, 'https://team.cloudflareaccess.com/cdn-cgi/access/login'],
    [302, ['https://team.cloudflareaccess.com/login']],
    [303, '/cdn-cgi/access/login'], [307, 'https://other.example/cdn-cgi/access/'],
    [308, '/cdn-cgi/access/authorized'],
  ])('converts Cloudflare Access redirect %s to a 401 problem response', (statusCode, location) => {
    const handler = createAoboboDevProxy({ API_HOST: 'https://example.com' })['/api'].on.proxyRes;
    const upstream = { statusCode, headers: { location }, resume: rstest.fn(), pipe: rstest.fn() };
    const response = responseMock();
    handler(upstream, {}, response);
    expect(response.writeHead).toHaveBeenCalledWith(401, { 'content-type': 'application/problem+json' });
    expect(JSON.parse(response.end.mock.calls[0][0])).toMatchObject({ status: 401, code: 'cloudflare_access', title: 'Unauthorized' });
    expect(upstream.resume).toHaveBeenCalledTimes(1);
    expect(upstream.pipe).not.toHaveBeenCalled();
  });

  it.each([
    [200, 'https://team.cloudflareaccess.com/login'],
    [302, 'https://example.com/login'], [302, []], [302, undefined],
  ])('forwards ordinary response %s without treating it as Access denial', (statusCode, location) => {
    const handler = createAoboboDevProxy({ API_HOST: 'https://example.com' })['/api'].on.proxyRes;
    const upstream = { statusCode, headers: { location }, pipe: rstest.fn() };
    const response = responseMock();
    handler(upstream, {}, response);
    expect(response.writeHead).toHaveBeenCalledWith(statusCode, upstream.headers);
    expect(upstream.pipe).toHaveBeenCalledWith(response);
  });

  it.each([
    'session=a; Secure; Domain=.example.com; HttpOnly; Path=/',
    ['session=a; secure; domain=example.com; SameSite=Lax', 'token=b; HttpOnly; SECURE'],
  ])('removes remote-only cookie flags while preserving other attributes', (cookies) => {
    const handler = createAoboboDevProxy({ API_HOST: 'https://example.com' })['/api'].on.proxyRes;
    const upstream = { statusCode: 200, headers: { 'set-cookie': cookies }, pipe: rstest.fn() };
    handler(upstream, {}, responseMock());
    const normalized = upstream.headers['set-cookie'];
    expect(Array.isArray(normalized)).toBe(true);
    expect(JSON.stringify(normalized)).not.toMatch(/Secure|Domain=/i);
    expect(JSON.stringify(normalized)).toContain('session=a');
  });

  it('uses Bad Gateway for a missing upstream status code', () => {
    const handler = createAoboboDevProxy({ API_HOST: 'https://example.com' })['/api'].on.proxyRes;
    const response = responseMock();
    handler({ headers: {}, pipe: rstest.fn() }, {}, response);
    expect(response.writeHead).toHaveBeenCalledWith(502, {});
  });
});

describe('proxy transport failures', () => {
  it.each(['EPIPE', 'ECONNRESET', 'ECONNREFUSED'])('ends an HTTP failure with 502 for %s', (code) => {
    const error = createAoboboDevProxy({ API_HOST: 'http://localhost:8080' })['/api'].on.error;
    const response = responseMock();
    error({ code, message: 'connection error' }, {}, response);
    expect(response.writeHead).toHaveBeenCalledWith(502, { 'content-type': 'application/problem+json' });
    expect(JSON.parse(response.end.mock.calls[0][0])).toEqual({ title: 'Bad Gateway', status: 502 });
    expect(console.error).toHaveBeenCalledTimes(code === 'ECONNREFUSED' ? 1 : 0);
  });

  it('avoids writing duplicate headers, destroyed responses or absent responses', () => {
    const handler = createAoboboDevProxy({ API_HOST: 'http://localhost:8080' })['/api'].on.error;
    const response = responseMock();
    response.headersSent = true;
    handler({ code: 'EPIPE' }, {}, response);
    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.end).toHaveBeenCalledTimes(1);
    response.destroyed = true;
    handler({ code: 'EPIPE' }, {}, response);
    handler({ code: 'EPIPE' }, {}, undefined);
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('destroys websocket-style responses when HTTP writeHead is unavailable', () => {
    const handler = createAoboboDevProxy({ WS_HOST: 'ws://localhost:8080' })['/api/v1/ws/server'].on.error;
    const response = { destroy: rstest.fn() };
    handler({ code: 'ECONNRESET' }, {}, response);
    expect(response.destroy).toHaveBeenCalledTimes(1);
    expect(() => handler({ code: 'ECONNRESET' }, {}, {})).not.toThrow();
  });
});
