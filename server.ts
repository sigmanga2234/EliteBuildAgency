import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";
import cookieSession from "cookie-session";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.GEMINI_API_KEY || 'secret'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: 'none'
  }));

  const oauth2Client = new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    `${process.env.APP_URL}/auth/callback`
  );

  // Auth URL endpoint
  app.get('/api/auth/url', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent'
    });
    res.json({ url });
  });

  // OAuth Callback
  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      // In a real app, you'd store these tokens in Firestore associated with the admin
      // For this demo, we'll just send them back or store in session
      req.session!.tokens = tokens;

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error getting tokens:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // Create Calendar Event
  app.post('/api/calendar/event', async (req, res) => {
    const { tokens, booking } = req.body;
    if (!tokens) return res.status(401).json({ error: 'No tokens provided' });

    const auth = new google.auth.OAuth2(
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET
    );
    auth.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth });
    
    const event = {
      summary: `Strategy Call: ${booking.fullName}`,
      description: `Service: ${booking.serviceType}\nPlatform: ${booking.socialPlatform}\nUsername: ${booking.socialUsername}\nEmail: ${booking.email}`,
      start: {
        date: booking.preferredDate,
      },
      end: {
        date: booking.preferredDate,
      },
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
      res.json(response.data);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
