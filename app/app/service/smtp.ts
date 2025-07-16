export async function getSmtpSettings() {
  const response = await fetch('/api/smtp-setting');
  if (!response.ok) {
    throw new Error('Failed to fetch SMTP settings');
  }
  return response.json();
} 