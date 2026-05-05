require("dotenv").config();

const express = require("express");
const session = require("express-session");
const axios = require("axios");
const cors = require("cors");

const app = express();

// ✅ ENV CONFIG
const PORT = process.env.PORT || 3001;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// 🔴 IMPORTANT: NO localhost fallback in production
const REDIRECT_URI =
  process.env.REDIRECT_URI || "https://cloudvandana-z84a.onrender.com/callback";

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

const SALESFORCE_LOGIN_URL =
  process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

// ✅ CORS
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

// ✅ SESSION (fixed for production)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "salesforce_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,       // 🔴 required for HTTPS (Render)
      sameSite: "none",   // 🔴 required for cross-site cookies
    },
  })
);

// 🔧 Helpers
function salesforceErrorMessage(error, fallbackMessage) {
  const data = error.response?.data;

  if (Array.isArray(data) && data.length > 0) {
    return data
      .map((item) => item.message || item.errorCode)
      .filter(Boolean)
      .join("; ");
  }

  if (data?.message) return data.message;

  return error.message || fallbackMessage;
}

function toolingQuery(instanceUrl, soql) {
  return `${instanceUrl}/services/data/v60.0/tooling/query/?q=${encodeURIComponent(soql)}`;
}

function salesforceAuthorizeUrl() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI, // 🔴 CRITICAL
    scope: "api refresh_token",
  });

  return `${SALESFORCE_LOGIN_URL}/services/oauth2/authorize?${params}`;
}

function salesforceHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

// 🌐 Routes

app.get("/", (req, res) => {
  res.send("Backend API is running");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 🔍 Debug route (VERY useful)
app.get("/debug/oauth", (req, res) => {
  res.json({
    redirectUri: REDIRECT_URI,
    frontendUrl: FRONTEND_URL,
    hasClientId: !!CLIENT_ID,
    hasClientSecret: !!CLIENT_SECRET,
    authorizeUrl: salesforceAuthorizeUrl(),
  });
});

// 🔐 Auth status
app.get("/auth/status", (req, res) => {
  res.json({
    authenticated: !!req.session.accessToken,
    instanceUrl: req.session.instanceUrl || null,
  });
});

// 🔑 Login
app.get("/login", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send("Salesforce OAuth not configured");
  }

  return res.redirect(salesforceAuthorizeUrl());
});

// 🔁 Callback
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (req.query.error) {
    return res
      .status(400)
      .send(req.query.error_description || req.query.error);
  }

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const response = await axios.post(
      `${SALESFORCE_LOGIN_URL}/services/oauth2/token`,
      null,
      {
        timeout: REQUEST_TIMEOUT_MS,
        params: {
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI, // 🔴 MUST MATCH
          code,
        },
      }
    );

    req.session.accessToken = response.data.access_token;
    req.session.instanceUrl = response.data.instance_url;

    return res.redirect(FRONTEND_URL);
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res
      .status(500)
      .send("OAuth failed. Check callback URL and env variables.");
  }
});

// 📥 Get validation rules
app.get("/validation-rules", async (req, res) => {
  const { accessToken, instanceUrl } = req.session;

  if (!accessToken || !instanceUrl) {
    return res.status(401).send("Not authenticated");
  }

  try {
    const response = await axios.get(
      toolingQuery(instanceUrl, "SELECT Id, ValidationName, Active FROM ValidationRule"),
      {
        headers: salesforceHeaders(accessToken),
      }
    );

    return res.json(response.data.records);
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).send("Error fetching rules");
  }
});

// 🔄 Update rule
app.patch("/validation-rules/:id", async (req, res) => {
  const { accessToken, instanceUrl } = req.session;
  const { active } = req.body;

  if (!accessToken || !instanceUrl) {
    return res.status(401).send("Not authenticated");
  }

  try {
    const ruleResponse = await axios.get(
      toolingQuery(
        instanceUrl,
        `SELECT Id, FullName, Metadata FROM ValidationRule WHERE Id='${req.params.id}'`
      ),
      { headers: salesforceHeaders(accessToken) }
    );

    const rule = ruleResponse.data.records[0];

    await axios.patch(
      `${instanceUrl}/services/data/v60.0/tooling/sobjects/ValidationRule/${req.params.id}`,
      {
        FullName: rule.FullName,
        Metadata: { ...rule.Metadata, active },
      },
      {
        headers: {
          ...salesforceHeaders(accessToken),
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).send("Error updating rule");
  }
});

// 🚪 Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});