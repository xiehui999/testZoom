const crypto = require('crypto')
const axios = require('axios')
const { KJUR } = require('jsrsasign')

const { URL } = require('url')
const jwt = require('jsonwebtoken')

// returns a base64 encoded url
const base64URL = (s) =>
  s
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

// returns a random string of format fmt
const rand = (fmt, depth = 32) => crypto.randomBytes(depth).toString(fmt)

// Get Zoom API URL from Zoom Host value
const host = new URL(process.env.ZOOM_HOST)
host.hostname = `api.${host.hostname}`

const baseURL = host.href

/**
 * Generic function for getting access or refresh tokens
 * @param {string} [id=''] - Username for Basic Auth
 * @param {string} [secret=''] - Password for Basic Auth
 * @param {Object} params - Request parameters (form-urlencoded)
 */
function tokenRequest(params, id = '', secret = '') {
  const username = id || process.env.ZOOM_CLIENT_ID
  const password = secret || process.env.ZOOM_CLIENT_SECRET

  return axios({
    data: new URLSearchParams(params).toString(),
    baseURL: process.env.ZOOM_HOST,
    url: '/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    auth: {
      username,
      password
    }
  }).then(({ data }) => Promise.resolve(data))
}

/**
 * Generic function for making requests to the Zoom API
 * @param {string} method - Request method
 * @param {string | URL} endpoint - Zoom API Endpoint
 * @param {string} token - Access Token
 * @param {object} [data=null] - Request data
 */
function apiRequest(method, endpoint, token, data = null) {
  return axios({
    data,
    method,
    baseURL,
    url: `/v2${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  }).then(({ data }) => Promise.resolve(data))
}

/**
 * Return the url, state and verifier for the Zoom App Install
 * @return {{verifier: string, state: string, url: module:url.URL}}
 */
function getInstallURL() {
  const state = rand('base64')
  const verifier = rand('ascii')

  const digest = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .toString()

  const challenge = base64URL(digest)

  const url = new URL('/oauth/authorize', process.env.ZOOM_HOST)

  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', process.env.ZOOM_CLIENT_ID)
  url.searchParams.set('redirect_uri', process.env.ZM_REDIRECT_URL)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)

  return { url, state, verifier }
}

/**
 * Obtains an OAuth access token from Zoom
 * @param {string} code - Authorization code from user authorization
 * @param verifier - code_verifier for PKCE
 * @return {Promise}  Promise resolving to the access token object
 */
async function getToken(code, verifier) {
  if (!code || typeof code !== 'string')
    throw error(500, 'authorization code must be a valid string')

  // if (!verifier || typeof verifier !== 'string')
  //   throw error(500, 'code verifier code must be a valid string')

  return tokenRequest({
    code,
    code_verifier: verifier,
    redirect_uri: process.env.ZM_REDIRECT_URL,
    grant_type: 'authorization_code'
  })
}

/**
 * Obtain a new Access Token from a Zoom Refresh Token
 * @param {string} token - Refresh token to use
 * @return {Promise<void>}
 */
async function refreshToken(token) {
  if (!token || typeof token !== 'string')
    throw createError(500, 'refresh token must be a valid string')

  return tokenRequest({
    refresh_token: token,
    grant_type: 'refresh_token'
  })
}

/**
 * Use the Zoom API to get a Zoom User
 * @param {string} uid - User ID to query on
 * @param {string} token Zoom App Access Token
 */
function getZoomUser(uid, token) {
  return apiRequest('GET', `/users/${uid}`, token)
}

function getCurrentZoomUser(token) {
  return apiRequest('GET', `/users/me`, token)
}

function createMeeting(token) {
  return apiRequest('POST', `/users/me/meetings`, token, {
    topic: '开发者会议',
    type: 2, // 立即会议
    start_time: new Date().toISOString(),
    duration: 60, // 会议时长 60 分钟
    timezone: 'UTC',
    settings: {
      host_video: true,
      participant_video: true,
      auto_recording: 'cloud' // 开启云录制
    }
  })
}

function addUserToMeeting(token, meetingId, email) {
  return apiRequest('POST', `/meetings/${meetingId}/registrants`, token, {
    email: email,
    first_name: '邀请用户',
    last_name: 'Test'
  })
}

function setCoHost(token, meetingId, email) {
  return apiRequest('PATCH', `/meetings/${meetingId}`, token, {
    settings: {
      alternative_hosts: email
    }
  })
}

function startRecording(token, meetingId, email) {
  return apiRequest('PATCH', `/meetings/${meetingId}/recordings`, token, {
    action: 'start'
  })
}

/**
 * Return the DeepLink for opening Zoom
 * @param {string} token - Zoom App Access Token
 * @return {Promise}
 */
function getDeeplink(token) {
  return apiRequest('POST', '/zoomapp/deeplink', token, {
    action: JSON.stringify({
      url: '/',
      role_name: 'Owner',
      verified: 1,
      role_id: 0
    })
  }).then((data) => Promise.resolve(data.deeplink))
}

const getZoomAccessToken = async (
  zoomAuthorizationCode,
  redirect_uri = process.env.ZOOM_APP_REDIRECT_URI,
  pkceVerifier = undefined
) => {
  const params = {
    grant_type: 'authorization_code',
    code: zoomAuthorizationCode,
    redirect_uri
  }

  if (typeof pkceVerifier === 'string') {
    params['code_verifier'] = pkceVerifier
  }

  const tokenRequestParamString = zoomHelpers.createRequestParamString(params)

  return axios({
    url: `${process.env.ZOOM_HOST}/oauth/token`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    auth: {
      username: process.env.ZOOM_APP_CLIENT_ID,
      password: process.env.ZOOM_APP_CLIENT_SECRET
    },
    data: tokenRequestParamString
  })
}

function generateJWTZoomToken(meetingNumber, role = 0) {
  const key = process.env.ZOOM_CLIENT_ID
  const secret = process.env.ZOOM_CLIENT_SECRET
  const iat = Math.floor(Date.now() / 1000) - 30  // 签发时间
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 // 过期时间 (1小时)
  const payload = {
    app_key: key,
    iat ,
    exp,
    tpc: meetingNumber.toString(), // 会议号
    role_type: role, // 1: 主持人, 0: 参会者
  };
  const key1 = jwt.sign(payload, secret, { algorithm: "HS256" });
  const oHeader = { alg: 'HS256', typ: 'JWT' }

  const oPayload = {
    appKey: key,
    sdkKey: key,
    mn: meetingNumber.toString(),
    role,
    iat,
    exp,
    tokenExp: exp
  }

  const sHeader = JSON.stringify(oHeader)
  const sPayload = JSON.stringify(oPayload)
  const sdkJWT = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, process.env.ZOOM_CLIENT_SECRET)
  return { key1, key2: sdkJWT}
}
module.exports = {
  getDeeplink,
  refreshToken,
  getInstallURL,
  getZoomUser,
  getCurrentZoomUser,
  getToken,
  createMeeting,
  startRecording,
  setCoHost,
  addUserToMeeting,
  generateJWTZoomToken,
}
