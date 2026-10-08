// Fake Supabase gateway: /rest/v1 -> PostgREST, /auth/v1 -> minimal GoTrue (password grant, /user, /logout).
import http from 'node:http'
import crypto from 'node:crypto'
const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'
const USERS = { 'a@x.com': '11111111-1111-4111-8111-111111111111', 'b@x.com': '22222222-2222-4222-8222-222222222222' }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(sub, email) {
  const now = Math.floor(Date.now() / 1000)
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}`
  return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`
}
const user = (sub, email) => ({ id: sub, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); res.end(JSON.stringify(obj)) }
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (req.url.startsWith('/rest/v1/')) {
    const up = http.request({ host: 'localhost', port: 54321, path: req.url.slice('/rest/v1'.length), method: req.method, headers: { ...req.headers, host: 'localhost:54321' } }, (r) => {
      res.writeHead(r.statusCode, { ...r.headers, 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' }); r.pipe(res)
    })
    return req.pipe(up)
  }
  let data = ''
  req.on('data', (c) => (data += c))
  req.on('end', () => {
    if (req.url.startsWith('/auth/v1/token')) {
      const { email, password } = JSON.parse(data || '{}')
      const sub = USERS[email]
      if (!sub || password !== 'pw') return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' })
      return send(res, 200, { access_token: jwt(sub, email), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + sub, user: user(sub, email) })
    }
    if (req.url.startsWith('/auth/v1/user')) {
      const tok = (req.headers.authorization || '').split(' ')[1] || ''
      const p = JSON.parse(Buffer.from(tok.split('.')[1] || 'e30', 'base64url'))
      return p.sub ? send(res, 200, user(p.sub, p.email)) : send(res, 401, { msg: 'no' })
    }
    if (req.url.startsWith('/auth/v1/logout')) return send(res, 204, {})
    send(res, 404, { msg: 'not found ' + req.url })
  })
}).listen(54320, () => console.log('proxy on 54320'))
