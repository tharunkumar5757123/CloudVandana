require("dotenv").config();

const express = require("express");
const session = require("express-session");
const axios = require("axios");

const app = express();

// 🔴 REQUIRED FOR RENDER (proxy + HTTPS cookies)
app.set("trust proxy", 1);

// ✅ ENV CONFIG
const PORT = process.env.PORT || 3001;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const REDIRECT_URI =
  process.env.REDIRECT_URI || "https://cloudvandana-z84a.onrender.com/callback";

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

const SALESFORCE_LOGIN_URL =
  process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";

// ✅ GLOBAL CORS FIX (robust)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // 🔥 Handle preflight properly
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.use(express.json());

// ✅ SESSION (production-safe)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "salesforce_secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: true,        // 🔴 ALWAYS true on Render (HTTPS)
      sameSite: "none",    // 🔴 REQUIRED for cross-site cookies
    },
  })
);

// 🔧 Helpers
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

// 🌐 Routes

app.get("/", (req, res) => {
  res.send("Backend API is running");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/auth/status", (req, res) => {
  res.json({
    authenticated: !!req.session.accessToken,
  });
});

// 🔑 Login
app.get("/login", (req, res) => {
  res.redirect(salesforceAuthorizeUrl());
});

// 🔁 Callback
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send("Missing code");

  try {
    const response = await axios.post(
      `${SALESFORCE_LOGIN_URL}/services/oauth2/token`,
      null,
      {
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

    // 🔴 VERY IMPORTANT
    req.session.save(() => {
      res.redirect(FRONTEND_URL);
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("OAuth failed");
  }
});

// 📥 Get validation rules
app.get("/validation-rules", async (req, res) => {
  const { accessToken, instanceUrl } = req.session;

  if (!accessToken) {
    return res.status(401).send("Not authenticated");
  }

  try {
    const response = await axios.get(
      toolingQuery(
        instanceUrl,
        "SELECT Id, ValidationName, Active FROM ValidationRule"
      ),
      { headers: salesforceHeaders(accessToken) }
    );

    res.json(response.data.records);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching rules");
  }
});

// 🔄 Update rule
app.patch("/validation-rules/:id", async (req, res) => {
  const { accessToken, instanceUrl } = req.session;
  const { active } = req.body;

  if (!accessToken) {
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

    res.json({ Id: req.params.id, Active: active });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error updating rule");
  }
});

// 🚪 Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// 🚀 Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});