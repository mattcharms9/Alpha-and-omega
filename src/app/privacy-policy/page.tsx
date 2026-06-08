export default function PrivacyPolicyPage() {
  const appUrl = "https://alpha-and-omega-c9dr.vercel.app";
  const email = "mattcharms9@gmail.com";
  const updated = "June 8, 2026";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "system-ui, sans-serif", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Last updated: {updated}</p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>1. Overview</h2>
        <p>Alpha &amp; Omega (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the Alpha &amp; Omega publishing platform at <a href={appUrl} style={{ color: "#2563eb" }}>{appUrl}</a>. This Privacy Policy explains how we collect, use, and protect information when you use our service.</p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>2. Information We Collect</h2>
        <p>We collect the following information:</p>
        <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li><strong>Account information:</strong> Email address and password (hashed) when you create an account.</li>
          <li><strong>Platform connections:</strong> OAuth tokens for Etsy and Pinterest when you connect those accounts. These tokens are stored securely and used only to publish content on your behalf.</li>
          <li><strong>Usage data:</strong> Product data, revenue records, and publishing activity you create within the app.</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>3. How We Use Your Information</h2>
        <ul style={{ paddingLeft: "1.5rem" }}>
          <li>To provide and operate the Alpha &amp; Omega platform</li>
          <li>To publish products to Etsy on your behalf when you request it</li>
          <li>To create and schedule Pinterest pins on your behalf when you request it</li>
          <li>To send you notifications about your account and publishing activity</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>4. Pinterest Data</h2>
        <p>When you connect your Pinterest account, we access your Pinterest boards and create pins on your behalf using the Pinterest API. We store your Pinterest access token securely. We do not sell, share, or transfer your Pinterest data to any third parties. You can disconnect your Pinterest account at any time from the Publishing page within the app, which will delete your stored Pinterest credentials.</p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>5. Etsy Data</h2>
        <p>When you connect your Etsy shop, we access your shop information and create listings on your behalf using the Etsy API. We store your Etsy access token securely. You can disconnect your Etsy shop at any time from the Publishing page.</p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>6. Data Storage and Security</h2>
        <p>Your data is stored in a secure PostgreSQL database. Passwords are hashed using bcrypt and never stored in plain text. OAuth tokens are stored encrypted. We use industry-standard security practices to protect your information.</p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>7. Data Sharing</h2>
        <p>We do not sell, trade, or share your personal information with third parties except as required to operate the service (e.g., database hosting via Neon, deployment via Vercel). We do not share your data with advertisers.</p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>8. Your Rights</h2>
        <p>You may request deletion of your account and all associated data at any time by contacting us at <a href={`mailto:${email}`} style={{ color: "#2563eb" }}>{email}</a>. You can disconnect connected platforms (Etsy, Pinterest) at any time from within the app.</p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>9. Contact</h2>
        <p>Questions about this Privacy Policy? Contact us at <a href={`mailto:${email}`} style={{ color: "#2563eb" }}>{email}</a>.</p>
      </section>
    </div>
  );
}
