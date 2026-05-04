# Salesforce Validation Rules Manager

This project allows managing Salesforce validation rules for the Account object through a web interface.

## Architecture

- **Frontend**: React app built with Vite, using JavaScript.
- **Backend**: Node.js Express server handling OAuth and API calls to Salesforce.
- **Salesforce**: Developer Org with validation rules on Account object.

## Setup

### Prerequisites

- Node.js installed
- Salesforce Developer Org
- Connected App in Salesforce with Client ID and Secret

### Salesforce Setup

1. Sign up at https://developer.salesforce.com/signup
2. Create a Connected App:
   - Name: ValidationRuleApp
   - Enable OAuth
   - Callback URL: http://localhost:5000/callback
   - Scopes: Full access, API, refresh_token
3. Note Client ID and Client Secret
4. Create 4-5 validation rules on Account object, e.g.:
   - Phone length check
   - Negative revenue check
   - Required name
   - HTTPS website
   - Industry selection

### Backend Setup

1. cd backend
2. Update .env with your CLIENT_ID and CLIENT_SECRET
3. npm install
4. node server.js

### Frontend Setup

1. cd frontend
2. npm install
3. npm run dev

## Usage

1. Open frontend at http://localhost:3000
2. Click "Login with Salesforce" to authenticate
3. Click "Get Validation Rules" to fetch rules
4. Toggle individual rules or "Toggle All"
5. Click "Deploy" to confirm changes

## Deployment

- Frontend: Deploy to Vercel/Netlify
- Backend: Deploy to Render/Railway

## Submission

Deploy both, share repo link and deployed URLs to careers@cloudvandana.com