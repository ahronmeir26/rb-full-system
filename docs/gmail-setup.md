# Gmail sync setup

The application uses Google's OAuth 2.0 web-server flow and requests only
`https://www.googleapis.com/auth/gmail.readonly`.

## Google Cloud

1. Create a dedicated Google Cloud project and enable the Gmail API.
2. Configure an External OAuth app named `SchoolBridge Program Operations`.
3. Add the Gmail read-only scope and the Gmail account that will be connected.
4. Create an OAuth client with application type `Web application`.
5. Add this authorized redirect URI:

   `https://schoolbridge-operations.ahronmeir26.chatgpt.site/api/gmail/callback`

## Runtime values

Configure these values in the hosted environment:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `GMAIL_TOKEN_ENCRYPTION_KEY`

The encryption key must be a long, random secret and must remain stable while a
Gmail connection exists. Changing it invalidates stored refresh tokens.

## Sync behavior

- The initial sync searches the complete mailbox for messages involving a
  recorded school contact or a unique school-owned email domain.
- Later syncs use Gmail history IDs and import only new messages.
- Common personal email domains are matched only by exact contact address.
- A scheduled Worker job refreshes connected mailboxes every ten minutes.
- The admin UI also checks every five minutes while open and includes a manual
  **Sync now** action.
