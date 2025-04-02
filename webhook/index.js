require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const axios = require('axios')
const {
  getInstallURL, getToken, getZoomUser, getCurrentZoomUser, createMeeting, addUserToMeeting,
  generateJWTZoomToken, getMeetingInfo, getMeetingRecordingsInfo, refreshToken,
} = require('./helpers/zoom-api')

const app = express()
const port = process.env.PORT || 4000
const ZOOM_BOT_ID = 'your_bot_user_id' // Bot 的 Zoom 账号
const ZOOM_API_TOKEN = 'your_zoom_jwt_token'

app.use(bodyParser.json())

const getAccountToken = async () => {
  try {
    const request = await axios.post(
      process.env.ZOOM_OAUTH_ENDPOINT,
      `grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_APP_CLIENT_ID}:${process.env.ZOOM_APP_CLIENT_SECRET}`).toString('base64')}`,
        },
      },
    )

    const response = await request.data
    console.log('response', response)
    return response
  } catch (e) {
    console.error(e?.response.message)
  }
}

app.get('/', (req, res) => {
  res.status(200)
  res.send(`Zoom Webhook sample successfully running. Set this URL with the /webhook path as your apps Event notification endpoint URL. https://github.com/zoom/webhook-sample`)
})
app.get('/install', async (req, res) => {
  const { url } = getInstallURL()
  res.redirect(url)
})
app.get('/generateJWTZoomToken', async (req, res) => {
  const { meetingId } = req.query
  if (!meetingId) return res.json('he meeting ID does not exist.')
  try {
    const recordingsInfo = await getMeetingRecordingsInfo(token, meetingId)
    const result = await generateJWTZoomToken(meetingId)
    const result1 = await getMeetingInfo(token, meetingId)
    res.json({ result, meetingInfo: result1, recordingsInfo })
  } catch (e) {
    console.log('errrrrrrrr', e)
    res.json(e)
  }
})
let token = "eyJzdiI6IjAwMDAwMiIsImFsZyI6IkhTNTEyIiwidiI6IjIuMCIsImtpZCI6ImEwZGNiMDAzLTU4OGUtNDU4Zi1iMjVmLTYzOGJlY2I3ODRhZSJ9.eyJhdWQiOiJodHRwczovL29hdXRoLnpvb20udXMiLCJ1aWQiOiJHbkZKZGlUMVNPdWZLc3pHZDVCRml3IiwidmVyIjoxMCwiYXVpZCI6ImM3YjY4Mzc2NzQxNzlhNDYwMTFlZDNlYTUxNmFlZWMzMGRhYmVmYjQ1ZDhiNmViNmU2OWE1NmQzY2JmZjJlMjQiLCJuYmYiOjE3NDM1NjAyMzgsImNvZGUiOiJ3UnEyQTVzcnFoRGREeFRCUHB4Um1Hdkk4ak5na2wzTkEiLCJpc3MiOiJ6bTpjaWQ6M2VNVnRkU1JKZUxPcGp4cHM4WkxRIiwiZ25vIjowLCJleHAiOjE3NDM1NjM4MzgsInR5cGUiOjAsImlhdCI6MTc0MzU2MDIzOCwiYWlkIjoiNXN0UHcyWmdSZXVZNTFoQ0FXejVDUSJ9.gQMQA2E0QeAxWE3VWywAnglNSSCBMfgwCm_ZxmOVrRAbNmxmxeqWu2zosfqXAFyVWmlONgBNRh98uUZShMLs9w"
let refreshTokenData = "eyJzdiI6IjAwMDAwMiIsImFsZyI6IkhTNTEyIiwidiI6IjIuMCIsImtpZCI6ImY5NTUyMmRlLTU2NmUtNGYzNi05ZjU2LTNmY2RhZmEwYTUxNyJ9.eyJhdWQiOiJodHRwczovL29hdXRoLnpvb20udXMiLCJ1aWQiOiJHbkZKZGlUMVNPdWZLc3pHZDVCRml3IiwidmVyIjoxMCwiYXVpZCI6ImM3YjY4Mzc2NzQxNzlhNDYwMTFlZDNlYTUxNmFlZWMzMGRhYmVmYjQ1ZDhiNmViNmU2OWE1NmQzY2JmZjJlMjQiLCJuYmYiOjE3NDM1NjAyMzgsImNvZGUiOiJ3UnEyQTVzcnFoRGREeFRCUHB4Um1Hdkk4ak5na2wzTkEiLCJpc3MiOiJ6bTpjaWQ6M2VNVnRkU1JKZUxPcGp4cHM4WkxRIiwiZ25vIjowLCJleHAiOjE3NTEzMzYyMzgsInR5cGUiOjEsImlhdCI6MTc0MzU2MDIzOCwiYWlkIjoiNXN0UHcyWmdSZXVZNTFoQ0FXejVDUSJ9.V3Kizoe94xyx7ZjJ2Zwfvc6LQrNv8pf_HmXy79ZPwN-FGhVFZtmqXLj-7LdxGhi3HRgYE-uOQ0Fg62S2YYpVVA"

app.get('/auth', async (req, res) => {
  const code = req.query.code
  const result = await getToken(code)
  token = result.access_token
  refreshTokenData = result.refresh_token
  try {
    const user = await getCurrentZoomUser(token)
    console.log('getZoomUser(token)')
    res.json({ token: result, user })
  } catch (e) {
    res.json(e)
    console.log('errrrrrrrr', e)
  }
})
app.get('/createMeeting', async (req, res) => {
  try {
    const result = await createMeeting(token)
    console.log('getZoomUser(token)', result)
    // const resultAdd = await addUserToMeeting(token, result.id, 'develop@altatech.dev')
    // console.log('addUserToMeeting', resultAdd)
    res.json(result)
  } catch (e) {
    console.log('errrrrrrrr', e)
    res.json(e)
  }
})
app.get('/joinBot', async (req, res) => {
  const { meetingId } = req.query
  try {
    console.log('token', token)
    console.log('getZoomUser(token)', getZoomUser(token))

    const response = await axios.post(
      `https://api.zoom.us/v2/meetings/${meetingId}/registrants`,
      {
        email: 'bot@example.com',
        first_name: 'Recording',
        last_name: 'Bot',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    console.log('✅ Bot 已加入会议:', response.data)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Bot 加入失败:', error)
    res.json({ success: false, error: error })
  }
})

//
app.get('/refreshToken', async (req, res) => {
  try {
    const result = await refreshToken(refreshTokenData)
    token = result.access_token
    refreshTokenData = result.refresh_token
    res.json(result)
  } catch (error) {
    console.error('❌ refreshToken失败:', error)
    res.json({ success: false, error: error })
  }
})
app.post('/webhookServer', (req, res) => {

  var response

  // console.log(req.headers)
  console.log(JSON.stringify(req.body))
  if (req.body?.payload?.object?.recording_files) {
    console.log('file', req.body?.payload?.object?.recording_files)
  }
  // construct the message string
  const message = `v0:${req.headers['x-zm-request-timestamp']}:${JSON.stringify(req.body)}`

  const hashForVerify = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(message).digest('hex')

  // hash the message string with your Webhook Secret Token and prepend the version semantic
  const signature = `v0=${hashForVerify}`

  // you validating the request came from Zoom https://marketplace.zoom.us/docs/api-reference/webhook-reference#notification-structure
  if (req.headers['x-zm-signature'] === signature) {

    // Zoom validating you control the webhook endpoint https://marketplace.zoom.us/docs/api-reference/webhook-reference#validate-webhook-endpoint
    if (req.body.event === 'endpoint.url_validation') {
      const hashForValidate = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(req.body.payload.plainToken).digest('hex')

      response = {
        message: {
          plainToken: req.body.payload.plainToken,
          encryptedToken: hashForValidate,
        },
        status: 200,
      }

      console.log(response.message)

      res.status(response.status)
      res.json(response.message)
    } else {
      response = { message: 'Authorized request to Zoom Webhook sample.', status: 200 }

      console.log(response.message)

      res.status(response.status)
      res.json(response)

      // business logic here, example make API request to Zoom or 3rd party

    }
  } else {

    response = { message: 'Unauthorized request to Zoom Webhook sample.', status: 401 }

    console.log(response.message)

    res.status(response.status)
    res.json(response)
  }
})

app.listen(port, () => console.log(`Zoom Webhook sample listening on port ${port}!`))
