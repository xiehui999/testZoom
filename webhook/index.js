require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const axios = require('axios')

const app = express()
const port = process.env.PORT || 4000
const ZOOM_BOT_ID = "your_bot_user_id"; // Bot 的 Zoom 账号
const ZOOM_API_TOKEN = "your_zoom_jwt_token";

app.use(bodyParser.json())

const getToken = async () => {
  try {
    const request = await axios.post(
      process.env.ZOOM_OAUTH_ENDPOINT,
      `grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_APP_CLIENT_ID}:${process.env.ZOOM_APP_CLIENT_SECRET}`).toString('base64')}`,
        }
      }
    );

    const response = await request.data;
    console.log('response', response)
    return response;
  } catch (e) {
    console.error(e?.response.message);
  }
}

app.get('/', (req, res) => {
  res.status(200)
  res.send(`Zoom Webhook sample successfully running. Set this URL with the /webhook path as your apps Event notification endpoint URL. https://github.com/zoom/webhook-sample`)
})
app.get("/joinBot", async (req, res) => {
  const { meetingId } = req.query;
  const token = await getToken()
  try {
    const response = await axios.post(
      `https://api.zoom.us/v2/meetings/${meetingId}/registrants`,
      {
        email: "bot@example.com",
        first_name: "Recording",
        last_name: "Bot",
      },
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Bot 已加入会议:", response.data);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Bot 加入失败:", error);
    res.json({ success: false, error: error });
  }
});

//
app.post('/webhookServer', (req, res) => {

  var response

  // console.log(req.headers)
  console.log(JSON.stringify(req.body))
  if(req.body?.payload?.object?.recording_files){
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
    if(req.body.event === 'endpoint.url_validation') {
      const hashForValidate = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(req.body.payload.plainToken).digest('hex')

      response = {
        message: {
          plainToken: req.body.payload.plainToken,
          encryptedToken: hashForValidate
        },
        status: 200
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
