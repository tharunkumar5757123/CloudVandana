require("dotenv").config();

const express = require("express");
const session = require("express-session");
const axios = require("axios");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3001;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SALESFORCE_LOGIN_URL =
  process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "salesforce_secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      sameSite: "lax",
    },
  })
);

function salesforceErrorMessage(error, fallbackMessage) {
  const data = error.response?.data;

  if (Array.isArray(data) && data.length > 0) {
    return data
      .map((item) => item.message || item.errorCode)
      .filter(Boolean)
      .join("; ");
  }

  if (data?.message) {
    return data.message;
  }

  return error.message || fallbackMessage;
}

function toolingQuery(instanceUrl, soql) {
  return `${instanceUrl}/services/data/v60.0/tooling/query/?q=${encodeURIComponent(soql)}`;
}

function salesforceAuthorizeUrl() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "api refresh_token",
  });

  return `${SALESFORCE_LOGIN_URL}/services/oauth2/authorize?${params}`;
}

function salesforceHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

app.get("/", (req, res) => {
  res.send("Backend API is running");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/debug/oauth", (req, res) => {
  res.json({
    port: PORT,
    frontendUrl: FRONTEND_URL,
    redirectUri: REDIRECT_URI,
    salesforceLoginUrl: SALESFORCE_LOGIN_URL,
    hasClientId: Boolean(CLIENT_ID),
    hasClientSecret: Boolean(CLIENT_SECRET),
    authorizeUrl: salesforceAuthorizeUrl(),
  });
});

app.get("/auth/status", (req, res) => {
  res.json({
    authenticated: Boolean(req.session.accessToken && req.session.instanceUrl),
    instanceUrl: req.session.instanceUrl || null,
  });
});

app.get("/login", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).send("Salesforce OAuth is not configured");
  }

  return res.redirect(salesforceAuthorizeUrl());
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (req.query.error) {
    console.error("Salesforce OAuth error:", req.query);
    return res
      .status(400)
      .send(`Salesforce OAuth failed: ${req.query.error_description || req.query.error}`);
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
          redirect_uri: REDIRECT_URI,
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
      .send(salesforceErrorMessage(error, "OAuth failed. Check Salesforce Connected App settings."));
  }
});

app.get("/validation-rules", async (req, res) => {
  const { accessToken, instanceUrl } = req.session;

  if (!accessToken || !instanceUrl) {
    return res.status(401).send("Not authenticated");
  }

  try {
    const response = await axios.get(
      toolingQuery(instanceUrl, "SELECT Id, ValidationName, Active FROM ValidationRule"),
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: salesforceHeaders(accessToken),
      }
    );

    return res.json(response.data.records);
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res
      .status(500)
      .send(salesforceErrorMessage(error, "Error fetching validation rules"));
  }
});

app.patch("/validation-rules/:id", async (req, res) => {
  const { accessToken, instanceUrl } = req.session;
  const { active } = req.body;

  if (!accessToken || !instanceUrl) {
    return res.status(401).send("Not authenticated");
  }

  if (typeof active !== "boolean") {
    return res.status(400).send("Missing active boolean");
  }

  try {
    const ruleResponse = await axios.get(
      toolingQuery(
        instanceUrl,
        `SELECT Id, FullName, Metadata FROM ValidationRule WHERE Id = '${req.params.id}'`
      ),
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: salesforceHeaders(accessToken),
      }
    );

    const rule = ruleResponse.data.records?.[0];

    if (!rule?.FullName || !rule?.Metadata) {
      return res.status(404).send("Validation rule metadata not found");
    }

    await axios.patch(
      `${instanceUrl}/services/data/v60.0/tooling/sobjects/ValidationRule/${req.params.id}`,
      {
        FullName: rule.FullName,
        Metadata: {
          ...rule.Metadata,
          active,
        },
      },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          ...salesforceHeaders(accessToken),
          "Content-Type": "application/json",
        },
      }
    );

    const updatedRuleResponse = await axios.get(
      toolingQuery(
        instanceUrl,
        `SELECT Id, ValidationName, Active FROM ValidationRule WHERE Id = '${req.params.id}'`
      ),
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: salesforceHeaders(accessToken),
      }
    );

    return res.json(updatedRuleResponse.data.records?.[0] || { Id: req.params.id, Active: active });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res
      .status(500)
      .send(salesforceErrorMessage(error, "Error updating rule"));
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.send("Logged out");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
