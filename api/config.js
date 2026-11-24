export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const googleClientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  const driveFolderName = (process.env.GOOGLE_DRIVE_FOLDER_NAME || 'OS Maneger - Anexos').trim() || 'OS Maneger - Anexos';
  const driveBackupFolderName = (process.env.GOOGLE_DRIVE_BACKUP_FOLDER_NAME || 'IBD Suite - Backups').trim() || 'IBD Suite - Backups';
  const storageBucket = (process.env.SUPABASE_STORAGE_BUCKET || 'os-attachments').trim() || 'os-attachments';
  const requireGmailDomain = String(process.env.REQUIRE_GMAIL_DOMAIN || '').trim().toLowerCase() === 'true';

  return res.status(200).json({
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    googleConfigured: Boolean(googleClientId),
    supabaseUrl,
    supabaseAnonKey,
    googleClientId,
    driveFolderName,
    driveBackupFolderName,
    storageBucket,
    requireGmailDomain
  });
}
