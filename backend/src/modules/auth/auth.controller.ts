import type { RequestHandler, Response } from 'express'
import { loginBody, changePasswordBody } from './auth.schema.js'
import * as authService from './auth.service.js'
import { ok } from '../../core/http/response.js'
import { config } from '../../core/config/index.js'
import { UnauthorizedError } from '../../core/errors/index.js'

const REFRESH_COOKIE = 'refresh_token'
const REFRESH_PATH = '/api/v1/auth'
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30d — matches the signed refresh-token TTL

const isProd = config.NODE_ENV === 'production'

// sameSite 'none' in prod so the cookie is sent on cross-site requests (frontend on a different
// origin than the API). 'none' requires Secure, which is true in prod. Locally we use 'lax' over
// http so the cookie still works without TLS.
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path: REFRESH_PATH,
  maxAge: REFRESH_MAX_AGE,
}

function setRefreshCookie(res: Response, jwt: string): void {
  res.cookie(REFRESH_COOKIE, jwt, refreshCookieOptions)
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH })
}

export const login: RequestHandler = async (req, res) => {
  const { email, password } = loginBody.parse(req.body)
  const ctx = { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null }
  const { accessToken, refreshToken, user } = await authService.login(email, password, ctx)
  setRefreshCookie(res, refreshToken)
  ok(res, { accessToken, user })
}

export const refresh: RequestHandler = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
  if (!token) throw new UnauthorizedError()
  const ctx = { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null }
  const { accessToken, refreshToken } = await authService.refresh(token, ctx)
  setRefreshCookie(res, refreshToken) // rotation: replace the cookie with the new token
  ok(res, { accessToken })
}

export const me: RequestHandler = async (req, res) => {
  ok(res, await authService.me(req.user!.sub))
}

export const changePassword: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = changePasswordBody.parse(req.body)
  ok(res, await authService.changePassword(req.user!.sub, currentPassword, newPassword))
}

export const logout: RequestHandler = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
  if (token) await authService.logout(token)
  clearRefreshCookie(res)
  ok(res, { success: true })
}
