"use client";

import { useState, useEffect } from "react";
import { Settings, Key, Plug, Bell, Palette, Shield, Target, Flame, MessageSquare, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiFetch } from "@/lib/api";

const TABS = [
  { id: "api", label: "API Keys", icon: Key },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "accountability", label: "Accountability", icon: Target },
];

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Sydney",
  "UTC",
];

interface AccountabilitySettings {
  dailyTarget: number;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  timezone: string;
  smsEnabled: boolean;
  pushEnabled: boolean;
  streakGoal: number;
}

const DEFAULT_SETTINGS: AccountabilitySettings = {
  dailyTarget: 20,
  reminderEnabled: true,
  reminderHour: 21,
  reminderMinute: 0,
  timezone: "America/Los_Angeles",
  smsEnabled: true,
  pushEnabled: true,
  streakGoal: 30,
};

function formatHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("api");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  // Accountability state
  const [acSettings, setAcSettings] = useState<AccountabilitySettings>(DEFAULT_SETTINGS);
  const [acLoading, setAcLoading] = useState(false);
  const [acSaved, setAcSaved] = useState(false);
  const [testSmsSending, setTestSmsSending] = useState(false);
  const [testPushSending, setTestPushSending] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "accountability") return;
    apiFetch("/api/accountability?action=status")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setAcSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      })
      .catch(console.error);
  }, [activeTab]);

  function saveApiKey() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function saveAccountability() {
    setAcLoading(true);
    try {
      await apiFetch("/api/accountability?action=save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acSettings),
      });
      setAcSaved(true);
      setTimeout(() => setAcSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setAcLoading(false);
    }
  }

  async function testSms() {
    setTestSmsSending(true);
    setTestMsg(null);
    try {
      await apiFetch("/api/accountability?action=test-sms", { method: "POST" });
      setTestMsg("SMS sent!");
    } catch {
      setTestMsg("SMS failed — check TWILIO env vars");
    } finally {
      setTestSmsSending(false);
      setTimeout(() => setTestMsg(null), 4000);
    }
  }

  async function testPush() {
    setTestPushSending(true);
    setTestMsg(null);
    try {
      await apiFetch("/api/accountability?action=test-push", { method: "POST" });
      setTestMsg("Push sent!");
    } catch {
      setTestMsg("Push failed — check VAPID env vars");
    } finally {
      setTestPushSending(false);
      setTimeout(() => setTestMsg(null), 4000);
    }
  }

  const previewText = acSettings.reminderEnabled
    ? `If you haven't posted ${acSettings.dailyTarget} products by ${formatHour(acSettings.reminderHour)} (${acSettings.timezone}), you'll receive a${acSettings.smsEnabled ? " text" : ""}${acSettings.smsEnabled && acSettings.pushEnabled ? " and" : ""}${acSettings.pushEnabled ? " push notification" : ""}.`
    : "Reminders are disabled. No notifications will be sent.";

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={Settings}
        title="Settings"
        iconColor="var(--text-secondary)"
        subtitle="Configure API keys, platform integrations, and system preferences."
      />

      <div style={{ padding: "24px 36px" }}>
        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ padding: "4px", background: "var(--bg-subtle)", borderRadius: 10, width: "fit-content", border: "1px solid var(--border-light)" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-muted)",
                background: activeTab === tab.id ? "var(--bg-surface)" : "transparent",
                border: activeTab === tab.id ? "1px solid var(--border-medium)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "api" && (
          <div className="flex flex-col gap-4" style={{ maxWidth: 640 }}>
            <Card gold>
              <CardBody>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: "var(--gold-glow)",
                      border: "1px solid rgba(201,168,76,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Key size={15} style={{ color: "var(--gold)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      Anthropic API Key
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      Required for all AI engine features
                    </div>
                  </div>
                  <span style={{ marginLeft: "auto" }}><Badge variant="rose">Required</Badge></span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div className="label mb-2">API Key</div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                  Add your key to the <code style={{ fontFamily: "monospace", color: "var(--gold)", fontSize: "0.82rem" }}>.env</code> file as{" "}
                  <code style={{ fontFamily: "monospace", color: "var(--gold)", fontSize: "0.82rem" }}>ANTHROPIC_API_KEY=sk-ant-...</code>.
                  Keys saved here are for local reference only and not persisted to the server.
                </div>
                <Button variant="gold" onClick={saveApiKey}>
                  {saved ? "✓ Key Format Noted" : "Save Reference"}
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="label mb-3">AI Engine Configuration</div>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Default Model", value: "claude-sonnet-4-6", desc: "Best balance of quality and cost" },
                    { label: "Max Tokens per Request", value: "8,000", desc: "For product and intelligence generation" },
                    { label: "Intelligence Scan Depth", value: "8 trends", desc: "Trends discovered per scan" },
                  ].map((config, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {config.label}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{config.desc}</div>
                      </div>
                      <Badge variant="muted">{config.value}</Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {activeTab === "integrations" && (
          <div style={{ maxWidth: 640 }}>
            <Card>
              <CardBody>
                <div className="label mb-4">Platform Integrations</div>
                <div className="flex flex-col gap-3">
                  {[
                    { name: "Amazon KDP", status: "Not Connected", color: "#f59e0b" },
                    { name: "Etsy API", status: "Not Connected", color: "#f97316" },
                    { name: "Gumroad", status: "Not Connected", color: "#10b981" },
                    { name: "Shopify", status: "Not Connected", color: "#22c55e" },
                    { name: "TikTok Shop", status: "Not Connected", color: "#ec4899" },
                  ].map((integration, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--text-muted)",
                          }}
                        />
                        <span style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>
                          {integration.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="muted">{integration.status}</Badge>
                        <Button variant="outline" size="sm">Connect</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {(activeTab === "appearance" || activeTab === "notifications") && (
          <div style={{ maxWidth: 640 }}>
            <Card>
              <CardBody>
                <div className="flex flex-col items-center justify-center" style={{ padding: "40px 0", textAlign: "center" }}>
                  <Shield size={32} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                    Coming Soon
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    These settings will be available in the next release.
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {activeTab === "accountability" && (
          <div className="flex flex-col gap-4" style={{ maxWidth: 680 }}>
            {/* Preview banner */}
            <div style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.2)",
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}>
              <span style={{ color: "var(--gold)", fontWeight: 600 }}>Preview: </span>{previewText}
            </div>

            {/* Daily Target */}
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 mb-4">
                  <Target size={15} style={{ color: "var(--gold)" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>Daily Target</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="label">Products per day</div>
                    <Badge variant="gold">{acSettings.dailyTarget}</Badge>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={acSettings.dailyTarget}
                    onChange={(e) => setAcSettings((s) => ({ ...s, dailyTarget: parseInt(e.target.value) }))}
                    style={{ width: "100%", accentColor: "var(--gold)" }}
                  />
                  <div className="flex justify-between" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    <span>1</span><span>25</span><span>50</span>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="label">Streak goal (days)</div>
                    <Badge variant="muted">{acSettings.streakGoal}</Badge>
                  </div>
                  <input
                    type="range"
                    min={7}
                    max={365}
                    step={1}
                    value={acSettings.streakGoal}
                    onChange={(e) => setAcSettings((s) => ({ ...s, streakGoal: parseInt(e.target.value) }))}
                    style={{ width: "100%", accentColor: "var(--gold)" }}
                  />
                  <div className="flex justify-between" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    <span>7</span><span>100</span><span>365</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Reminder Timing */}
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bell size={15} style={{ color: "var(--gold)" }} />
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>Reminder Timing</div>
                  </div>
                  <button
                    onClick={() => setAcSettings((s) => ({ ...s, reminderEnabled: !s.reminderEnabled }))}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: acSettings.reminderEnabled ? "rgba(201,168,76,0.15)" : "var(--bg-elevated)",
                      color: acSettings.reminderEnabled ? "var(--gold)" : "var(--text-muted)",
                      border: `1px solid ${acSettings.reminderEnabled ? "rgba(201,168,76,0.3)" : "var(--border-default)"}`,
                      cursor: "pointer",
                    }}
                  >
                    {acSettings.reminderEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div className="flex gap-4">
                  <div style={{ flex: 1 }}>
                    <div className="label mb-2">Reminder hour</div>
                    <select
                      value={acSettings.reminderHour}
                      onChange={(e) => setAcSettings((s) => ({ ...s, reminderHour: parseInt(e.target.value) }))}
                      disabled={!acSettings.reminderEnabled}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 8,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                        opacity: acSettings.reminderEnabled ? 1 : 0.4,
                      }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{formatHour(i)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="label mb-2">Timezone</div>
                    <select
                      value={acSettings.timezone}
                      onChange={(e) => setAcSettings((s) => ({ ...s, timezone: e.target.value }))}
                      disabled={!acSettings.reminderEnabled}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 8,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                        opacity: acSettings.reminderEnabled ? 1 : 0.4,
                      }}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Channels */}
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone size={15} style={{ color: "var(--gold)" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>Notification Channels</div>
                </div>

                {/* SMS */}
                <div style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: 10,
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={13} style={{ color: "var(--text-secondary)" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>SMS (Twilio)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAcSettings((s) => ({ ...s, smsEnabled: !s.smsEnabled }))}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          background: acSettings.smsEnabled ? "rgba(34,197,94,0.15)" : "var(--bg-card)",
                          color: acSettings.smsEnabled ? "#22c55e" : "var(--text-muted)",
                          border: `1px solid ${acSettings.smsEnabled ? "rgba(34,197,94,0.3)" : "var(--border-default)"}`,
                          cursor: "pointer",
                        }}
                      >
                        {acSettings.smsEnabled ? "On" : "Off"}
                      </button>
                      <Button variant="outline" size="sm" onClick={testSms} disabled={testSmsSending}>
                        {testSmsSending ? "Sending..." : "Test"}
                      </Button>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, ALERT_PHONE_NUMBER in .env
                  </div>
                </div>

                {/* Push */}
                <div style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Bell size={13} style={{ color: "var(--text-secondary)" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>Web Push (VAPID)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAcSettings((s) => ({ ...s, pushEnabled: !s.pushEnabled }))}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          background: acSettings.pushEnabled ? "rgba(34,197,94,0.15)" : "var(--bg-card)",
                          color: acSettings.pushEnabled ? "#22c55e" : "var(--text-muted)",
                          border: `1px solid ${acSettings.pushEnabled ? "rgba(34,197,94,0.3)" : "var(--border-default)"}`,
                          cursor: "pointer",
                        }}
                      >
                        {acSettings.pushEnabled ? "On" : "Off"}
                      </button>
                      <Button variant="outline" size="sm" onClick={testPush} disabled={testPushSending}>
                        {testPushSending ? "Sending..." : "Test"}
                      </Button>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env. Browser permission required.
                  </div>
                </div>

                {testMsg && (
                  <div style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: testMsg.includes("failed") ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                    color: testMsg.includes("failed") ? "#ef4444" : "#22c55e",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}>
                    {testMsg}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Milestone info */}
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 mb-3">
                  <Flame size={15} style={{ color: "var(--gold)" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>Milestones</div>
                </div>
                <div className="flex flex-col gap-2">
                  {[7, 14, 30, 60, 100].map((day) => (
                    <div key={day} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 7,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}>
                      <span style={{ fontSize: "0.83rem", color: "var(--text-primary)", fontWeight: 500 }}>{day}-Day Streak</span>
                      <Badge variant="muted">SMS + Push</Badge>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 10 }}>
                  Milestone notifications fire at end-of-day when the streak threshold is crossed.
                </div>
              </CardBody>
            </Card>

            <Button variant="gold" onClick={saveAccountability} disabled={acLoading}>
              {acLoading ? "Saving..." : acSaved ? "✓ Saved" : "Save Accountability Settings"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
