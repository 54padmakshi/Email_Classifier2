require('dotenv').config();  // Load environment variables from .env file
const express = require('express');
const { google } = require('googleapis');
const { Configuration, OpenAIApi } = require('openai');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000; // Use PORT environment variable

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'build')));

let clientId = process.env.CLIENT_ID;
let clientSecret = process.env.CLIENT_SECRET;
let openaiApiKey = process.env.OPENAI_API_KEY;
const redirectUri = process.env.REDIRECT_URI;

app.post('/api/update-credentials', (req, res) => {
  const { newClientId, newClientSecret, newOpenaiApiKey } = req.body;

  if (newClientId) clientId = newClientId;
  if (newClientSecret) clientSecret = newClientSecret;
  if (newOpenaiApiKey) openaiApiKey = newOpenaiApiKey;

  res.send('Credentials updated successfully');
});

const oAuth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);

app.post('/api/save-api-key', (req, res) => {
  const { apiKey } = req.body;
  openaiApiKey = apiKey;  // Update the API key dynamically
  res.send('API key saved successfully');
});

app.get('/api/emails', async (req, res) => {
  try {
    const tokens = await oAuth2Client.getAccessToken();
    oAuth2Client.setCredentials(tokens.res.data);

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const response = await gmail.users.messages.list({ userId: 'me' });

    const emailPromises = response.data.messages.map(async (message) => {
      const email = await gmail.users.messages.get({ userId: 'me', id: message.id });
      return email.data;
    });

    const emails = await Promise.all(emailPromises);
    res.json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Error fetching emails' });
  }
});

app.post('/api/classify', async (req, res) => {
  const { emails, apiKey } = req.body;d
  const openai = new OpenAIApi(new Configuration({
    apiKey: apiKey || openaiApiKey,
  }));

  try {
    const emailText = emails.map((email) => email.snippet).join('\n\n');
    const completion = await openai.createCompletion({
      model: 'gpt-3.5-turbo',
      prompt: `Classify the following emails:\n\n${emailText}\n\nClassifications:`,
      max_tokens: 50,
    });

    res.json(completion.data.choices.map(choice => choice.text));
  } catch (error) {
    console.error('Error classifying emails:', error);
    res.status(500).json({ error: 'Error classifying emails' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
