import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// --- Load Credentials from Environment Variables ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const AGENT_CALENDAR_ID = process.env.AGENT_CALENDAR_ID;

// --- Create and configure the OAuth2 Client ---
// This client will use our credentials to get permission to access the calendar.
const oAuth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  // This is the redirect URL, which is not used in this server-to-server flow
  // but is required by the library.
  "http://localhost:3000" 
);
oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

// Create a new instance of the Google Calendar API
const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

export async function POST(req: NextRequest) {
  // Check if all required environment variables are set
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !AGENT_CALENDAR_ID) {
    console.error("Missing Google Calendar API credentials in environment variables.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  try {
    const { propertyAddress, userEmail, userName, dateTime } = await req.json();

    if (!propertyAddress) {
      return NextResponse.json({ error: 'Property address is required' }, { status: 400 });
    }

    // --- Construct the Calendar Event Object ---
    // This is the blueprint for the event we'll create.
    const event = {
      summary: `Property Viewing: ${propertyAddress}`,
      location: propertyAddress,
      description: `Viewing appointment for ${userName} (${userEmail}).`,
      start: {
        dateTime: new Date(dateTime).toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        // Assume viewings are 30 minutes long
        dateTime: new Date(new Date(dateTime).getTime() + 30 * 60000).toISOString(),
        timeZone: 'America/New_York',
      },
      // Invite the user to the event
      attendees: [{ email: userEmail }],
      // Add a reminder notification
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', 'minutes': 24 * 60 }, // 24 hours before
          { method: 'popup', 'minutes': 30 }, // 30 minutes before
        ],
      },
    };

    // --- Insert the Event into the Calendar ---
    const response = await calendar.events.insert({
      calendarId: AGENT_CALENDAR_ID,
      requestBody: event,
      sendNotifications: true, // This sends an email invitation to the user
    });

    return NextResponse.json({ success: true, message: "Viewing scheduled successfully!", data: response.data });

  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json({ error: 'Failed to schedule viewing' }, { status: 500 });
  }
}

