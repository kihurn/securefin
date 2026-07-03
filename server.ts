import 'dotenv/config';
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { supabase } from "./src/lib/supabase.ts";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";

// Normalize Supabase snake_case responses to camelCase for the frontend
const normalizeUser = (u: any) => ({
  id: u.id,
  uid: u.uid,
  email: u.email,
  name: u.name,
  jobTitle: u.job_title,
  organization: u.organization,
  avatarUrl: u.avatar_url,
  twoFactorEnabled: u.two_factor_enabled,
  defaultCurrency: u.default_currency,
  language: u.language,
  emailAlerts: u.email_alerts,
  pushNotifications: u.push_notifications,
  smsMarketing: u.sms_marketing,
  createdAt: u.created_at,
  balanceOperational: u.balance_operational,
  balanceVault: u.balance_vault,
  balanceReserve: u.balance_reserve,
});

const normalizeTransaction = (t: any) => ({
  id: t.id,
  userId: t.user_id,
  date: t.date,
  time: t.time,
  description: t.description,
  merchant: t.merchant,
  category: t.category,
  amount: t.amount,
  status: t.status,
  notes: t.notes,
  attachmentName: t.attachment_name,
  attachmentSize: t.attachment_size,
  iconName: t.icon_name,
  createdAt: t.created_at,
});

const normalizeSession = (s: any) => ({
  id: s.id,
  userId: s.user_id,
  device: s.device,
  location: s.location,
  status: s.status,
  lastActive: s.last_active,
  createdAt: s.created_at,
});

const normalizeObligation = (o: any) => ({
  id: o.id,
  userId: o.user_id,
  day: o.day,
  month: o.month,
  description: o.description,
  category: o.category,
  amount: o.amount,
  status: o.status,
  createdAt: o.created_at,
});

// Helper static initial values
const defaultTransactions = [
  {
    date: 'Oct 24, 2024',
    time: '14:32 PM',
    description: 'Amazon Web Services',
    merchant: 'Amazon Web Services',
    category: 'Technology',
    amount: -1420.00,
    status: 'Verified',
    notes: "Monthly compute usage for production cluster 'Sigma'. Approved by Financial Controller.",
    attachment_name: 'Invoiced_94821.pdf',
    attachment_size: '2.4 MB',
    icon_name: 'cloud'
  },
  {
    date: 'Oct 22, 2024',
    time: '09:15 AM',
    description: 'Internal Transfer',
    merchant: 'From Savings *4920',
    category: 'Financial Services',
    amount: 15000.00,
    status: 'Verified',
    notes: 'Quarterly liquidity rebalancing between operational vault and main vault.',
    attachment_name: 'Transfer_Receipt_94822.pdf',
    attachment_size: '1.1 MB',
    icon_name: 'account_balance'
  },
  {
    date: 'Oct 21, 2024',
    time: '18:45 PM',
    description: 'Delta Air Lines',
    merchant: 'Delta Air Lines',
    category: 'Travel',
    amount: -840.50,
    status: 'Pending',
    notes: 'Round-trip flights for Q4 investment board meeting in Geneva.',
    attachment_name: 'E-Ticket_Delta_94823.pdf',
    attachment_size: '950 KB',
    icon_name: 'flight'
  },
  {
    date: 'Oct 20, 2024',
    time: '11:02 AM',
    description: 'Cloudflare Inc.',
    merchant: 'Cloudflare Inc.',
    category: 'Infrastructure',
    amount: -2100.00,
    status: 'Verified',
    notes: 'Enterprise DDoS protection and SSL certificate renewals for primary trading gateway.',
    attachment_name: 'Cloudflare_Invoice_Oct.pdf',
    attachment_size: '1.8 MB',
    icon_name: 'security'
  },
  {
    date: 'Oct 18, 2024',
    time: '20:10 PM',
    description: 'The Grillhouse',
    merchant: 'The Grillhouse',
    category: 'Dining',
    amount: -342.15,
    status: 'Verified',
    notes: 'Executive client dinner with principal officers from Sterling Partners.',
    attachment_name: 'Grillhouse_Receipt_94825.pdf',
    attachment_size: '430 KB',
    icon_name: 'restaurant'
  },
  {
    date: 'Oct 15, 2024',
    time: '12:00 PM',
    description: 'Apple Store',
    merchant: 'Apple Store Regent St',
    category: 'Technology',
    amount: -2499.00,
    status: 'Verified',
    notes: 'Hardware upgrade: MacBook Pro M3 for quantitative analysis development.',
    attachment_name: 'Apple_Store_Invoice_94826.pdf',
    attachment_size: '3.2 MB',
    icon_name: 'shopping_bag'
  },
  {
    date: 'Oct 12, 2024',
    time: '08:00 AM',
    description: 'Monthly Dividend',
    merchant: 'Investment Portfolio SPY',
    category: 'Income',
    amount: 1250.00,
    status: 'Verified',
    notes: 'Automated reinvested dividend payout from SPDR S&P 500 ETF Trust.',
    attachment_name: 'Dividend_Statement_Oct.pdf',
    attachment_size: '1.5 MB',
    icon_name: 'south_west'
  }
];

const defaultSessions = [
  {
    device: 'MacBook Pro 16" • London, UK',
    location: 'Current Session • Chrome',
    status: 'active',
    last_active: 'Just now'
  },
  {
    device: 'iPhone 15 Pro • Zurich, CH',
    location: 'Last active: 2 hours ago • FinTrust App',
    status: 'inactive',
    last_active: '2 hours ago'
  }
];

const defaultScheduledObligations = [
  {
    day: '24',
    month: 'Oct',
    description: 'Vanguard Global REIT Fund',
    category: 'Recurring Investment • Monthly',
    amount: 12500.00,
    status: 'Processing'
  },
  {
    day: '01',
    month: 'Nov',
    description: 'Manhattan Sky Residence',
    category: 'Lease Payment • Automatic',
    amount: 8200.00,
    status: 'Scheduled'
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Serve the auth popup for secure iframe-free Google Login
  app.get("/auth-popup", (req, res) => {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      const firebaseConfig = fs.readFileSync(configPath, "utf8");
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sovereign Identity Authorization</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background-color: #0b0f19;
      color: #ffffff;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
  </style>
</head>
<body class="flex flex-col items-center justify-center min-h-screen px-4">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
    <div class="mb-6 flex justify-center">
      <div class="p-3 bg-blue-500/10 rounded-xl text-blue-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z"/><path d="m9 12 2 2 4-4"/></svg>
      </div>
    </div>
    
    <h1 class="text-xl font-bold mb-2">Sovereign Identity Verification</h1>
    <p class="text-xs text-slate-400 mb-6">Authorize your Google Identity securely to sync with the FinTrust cryptographic ledger.</p>
    
    <div id="status-container" class="space-y-4">
      <button id="btn-auth" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 active:scale-[0.98]">
        <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with Google
      </button>
    </div>
    
    <div class="mt-6 text-[10px] text-slate-500 font-mono">
      Origin: <span id="origin-domain"></span>
    </div>
  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    document.getElementById('origin-domain').textContent = window.location.origin;

    const firebaseConfig = ${firebaseConfig};
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    const btnAuth = document.getElementById('btn-auth');
    const statusContainer = document.getElementById('status-container');

    btnAuth.addEventListener('click', async () => {
      statusContainer.innerHTML = \`
        <div class="flex items-center justify-center gap-3 py-3 text-sm text-slate-400">
          <svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting to Google...
        </div>
      \`;

      try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const googleIdToken = credential.idToken;
        const googleAccessToken = credential.accessToken;

        statusContainer.innerHTML = \`
          <div class="text-center py-2">
            <div class="text-green-400 font-semibold mb-1">✓ Verification Successful</div>
            <div class="text-xs text-slate-400">Syncing with parent workspace...</div>
          </div>
        \`;

        if (window.opener) {
          window.opener.postMessage({
            type: 'FIREBASE_AUTH_SUCCESS',
            googleIdToken: googleIdToken,
            googleAccessToken: googleAccessToken
          }, '*');
          
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          statusContainer.innerHTML = \`
            <div class="text-amber-400 text-sm mb-2">No parent window detected.</div>
            <a href="/" class="text-xs text-blue-400 underline">Return to App</a>
          \`;
        }
      } catch (error) {
        console.error("Auth popup error:", error);
        statusContainer.innerHTML = \`
          <div class="text-red-400 text-sm mb-4">Error: \${error.message || 'Authorization aborted'}</div>
          <button id="btn-retry" class="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition">
            Retry Authorization
          </button>
        \`;
        document.getElementById('btn-retry').addEventListener('click', () => window.location.reload());
      }
    });
  </script>
</body>
</html>
      `;
      res.send(html);
    } catch (err: any) {
      res.status(500).send("Error generating authorization interface: " + err.message);
    }
  });

  // Sync profile & seed default records if they are a newly created user
  app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const email = req.firebaseUser!.email || "no-email@fintrust.global";
      const name = req.firebaseUser!.name || email.split("@")[0];

      // Read extra body parameters if user signed up with details
      const body = req.body || {};
      const job_title = body.jobTitle || "Corporate Node Administrator";
      const organization = body.organization || "FinTrust Global Node";
      const avatar_url = body.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
      const two_factor_enabled = body.twoFactorEnabled !== undefined ? body.twoFactorEnabled : true;

      // Check if user already exists
      const { data: existingUsers, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .limit(1);

      if (fetchError) throw fetchError;

      let userRecord;
      if (!existingUsers || existingUsers.length === 0) {
        // Insert new user
        const { data: newUsers, error: insertError } = await supabase
          .from('users')
          .insert({
            uid,
            email,
            name,
            job_title,
            organization,
            avatar_url,
            two_factor_enabled,
            default_currency: 'USD ($) - United States Dollar',
            language: 'English (Global)',
            email_alerts: true,
            push_notifications: false,
            sms_marketing: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        userRecord = newUsers;

        // Seed default sessions (use raw snake_case field names for Supabase insert)
        const { error: sessionsError } = await supabase
          .from('sessions')
          .insert(defaultSessions.map(s => ({ ...s, user_id: userRecord.id })));
        if (sessionsError) throw sessionsError;

        // Seed default transactions
        const { error: txError } = await supabase
          .from('transactions')
          .insert(defaultTransactions.map(t => ({ ...t, user_id: userRecord.id })));
        if (txError) throw txError;

        // Seed default scheduled obligations
        const { error: oblError } = await supabase
          .from('scheduled_obligations')
          .insert(defaultScheduledObligations.map(o => ({ ...o, user_id: userRecord.id })));
        if (oblError) throw oblError;

      } else {
        // User already exists — just return their record
        userRecord = existingUsers[0];
      }

      res.json(normalizeUser(userRecord));
    } catch (error: any) {
      console.error("Auth sync failed:", error);
      res.status(500).json({ error: "Database authentication synchronization failed.", details: error.message });
    }
  });

  // Get user profile
  app.get("/api/user/profile", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "User profile not found." });
      }
      res.json(normalizeUser(data));
    } catch (error: any) {
      console.error("Fetch profile failed:", error);
      res.status(500).json({ error: "Failed to fetch sovereign profile data." });
    }
  });

  // Update user profile
  app.post("/api/user/profile", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const body = req.body;

      const { data, error } = await supabase
        .from('users')
        .update({
          name: body.name,
          job_title: body.jobTitle,
          organization: body.organization,
          two_factor_enabled: body.twoFactorEnabled,
          default_currency: body.defaultCurrency,
          language: body.language,
          email_alerts: body.emailAlerts,
          push_notifications: body.pushNotifications,
          sms_marketing: body.smsMarketing,
        })
        .eq('uid', uid)
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Profile node mapping failed." });
      }
      res.json(normalizeUser(data));
    } catch (error: any) {
      console.error("Update profile failed:", error);
      res.status(500).json({ error: "Failed to update sovereign profile node." });
    }
  });

  // Get transactions
  app.get("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;

      // Get internal user record
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('uid', uid)
        .single();

      if (userError || !userRecord) {
        return res.status(404).json({ error: "User mapping unresolved." });
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userRecord.id)
        .order('id', { ascending: false });

      if (error) throw error;
      res.json((data ?? []).map(normalizeTransaction));
    } catch (error: any) {
      console.error("Fetch transactions failed:", error);
      res.status(500).json({ error: "Failed to query immutable ledger receipts." });
    }
  });

  // Create transaction (New Vault Transfer)
  app.post("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const body = req.body;

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('uid', uid)
        .single();

      if (userError || !userRecord) {
        return res.status(404).json({ error: "User mapping unresolved." });
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userRecord.id,
          date: body.date,
          time: body.time,
          description: body.description,
          merchant: body.merchant,
          category: body.category,
          amount: Number(body.amount),
          status: body.status,
          notes: body.notes || "",
          attachment_name: body.attachmentName || null,
          attachment_size: body.attachmentSize || null,
          icon_name: body.iconName,
        })
        .select()
        .single();

      if (error) throw error;
      res.json(normalizeTransaction(data));
    } catch (error: any) {
      console.error("Create transaction failed:", error);
      res.status(500).json({ error: "Failed to commit transfer sequence to ledger." });
    }
  });

  // Get scheduled obligations
  app.get("/api/scheduled-obligations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('uid', uid)
        .single();

      if (userError || !userRecord) {
        return res.status(404).json({ error: "User mapping unresolved." });
      }

      const { data, error } = await supabase
        .from('scheduled_obligations')
        .select('*')
        .eq('user_id', userRecord.id);

      if (error) throw error;
      res.json((data ?? []).map(normalizeObligation));
    } catch (error: any) {
      console.error("Fetch obligations failed:", error);
      res.status(500).json({ error: "Failed to retrieve scheduled ledger commitments." });
    }
  });

  // Get sessions
  app.get("/api/sessions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('uid', uid)
        .single();

      if (userError || !userRecord) {
        return res.status(404).json({ error: "User mapping unresolved." });
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userRecord.id);

      if (error) throw error;
      res.json((data ?? []).map(normalizeSession));
    } catch (error: any) {
      console.error("Fetch sessions failed:", error);
      res.status(500).json({ error: "Failed to retrieve authenticated telemetry logs." });
    }
  });

  // Get balances
  app.get("/api/balances", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;

      const { data, error } = await supabase
        .from('users')
        .select('balance_operational, balance_vault, balance_reserve')
        .eq('uid', uid)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Balance record not found." });
      }

      res.json({
        operational: data.balance_operational,
        vault: data.balance_vault,
        reserve: data.balance_reserve,
      });
    } catch (error: any) {
      console.error("Fetch balances failed:", error);
      res.status(500).json({ error: "Failed to retrieve account balances." });
    }
  });

  // Update balances
  app.post("/api/balances", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const { operational, vault, reserve } = req.body;

      const { data, error } = await supabase
        .from('users')
        .update({
          balance_operational: operational,
          balance_vault: vault,
          balance_reserve: reserve,
        })
        .eq('uid', uid)
        .select('balance_operational, balance_vault, balance_reserve')
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Balance update failed." });
      }

      res.json({
        operational: data.balance_operational,
        vault: data.balance_vault,
        reserve: data.balance_reserve,
      });
    } catch (error: any) {
      console.error("Update balances failed:", error);
      res.status(500).json({ error: "Failed to update account balances." });
    }
  });

  // Vite development / production fallback middleware
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
