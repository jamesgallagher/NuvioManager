import React, { useState } from 'react';
import { ManagedAccount } from '../../types/nuvio';
import { getSupabaseClient, MissingAnonKeyError, DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from '../../services/supabaseClient';
import { X, Key, Mail, Lock, Server, Check, AlertCircle, Loader2 } from 'lucide-react';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAccount: (account: ManagedAccount) => void;
  initialAccount?: ManagedAccount | null;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSaveAccount,
  initialAccount,
}) => {
  const [name, setName] = useState(initialAccount?.name || '');
  const [region, setRegion] = useState(initialAccount?.region || '');
  const [authMethod, setAuthMethod] = useState<'password' | 'token'>('password');
  const [email, setEmail] = useState(initialAccount?.email || '');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState(initialAccount?.accessToken || '');
  const [supabaseUrl, setSupabaseUrl] = useState(
    initialAccount?.supabaseUrl || DEFAULT_SUPABASE_URL
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    initialAccount?.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      let finalUserId = initialAccount?.userId;
      let finalAccessToken = accessToken.trim();
      let finalRefreshToken = initialAccount?.refreshToken;

      const anonKey = supabaseAnonKey.trim();
      if (anonKey.length === 0) {
        throw new MissingAnonKeyError();
      }

      const client = getSupabaseClient(supabaseUrl.trim(), anonKey);

      if (authMethod === 'password') {
        if (!email.trim() || !password) {
          throw new Error('Please enter both email and password.');
        }

        const { data, error: authErr } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (authErr) throw authErr;
        if (!data.session || !data.user) {
          throw new Error('No session returned from authentication server.');
        }

        finalUserId = data.user.id;
        finalAccessToken = data.session.access_token;
        finalRefreshToken = data.session.refresh_token;
      } else {
        // Token method
        if (!finalAccessToken) {
          throw new Error('Please paste a valid session token.');
        }

        // Verify token with getUser
        const authClient = getSupabaseClient(
          supabaseUrl.trim(),
          supabaseAnonKey.trim(),
          finalAccessToken
        );
        const { data, error: userErr } = await authClient.auth.getUser(finalAccessToken);
        if (userErr) {
          throw userErr;
        } else if (data.user) {
          finalUserId = data.user.id;
          if (!email) setEmail(data.user.email || '');
        }
      }

      // Check available profiles
      let profiles = initialAccount?.profiles;
      try {
        const authedClient = getSupabaseClient(
          supabaseUrl.trim(),
          supabaseAnonKey.trim(),
          finalAccessToken
        );
        const { data: profileData } = await authedClient.rpc('sync_pull_profiles');
        if (Array.isArray(profileData) && profileData.length > 0) {
          profiles = profileData.map((p: any) => ({
            id: p.id,
            name: p.name || `Profile ${p.id}`,
            isPrimary: p.is_primary,
            avatarColorHex: p.avatar_color_hex,
          }));
        }
      } catch {
        // fallback to default profile 1
        if (!profiles || profiles.length === 0) {
          profiles = [{ id: 1, name: 'Default', isPrimary: true }];
        }
      }

      const account: ManagedAccount = {
        id: initialAccount?.id || crypto.randomUUID(),
        name: name.trim() || (email ? email.split('@')[0] : 'Managed Account'),
        email: email.trim(),
        region: region.trim(),
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim(),
        accessToken: finalAccessToken,
        refreshToken: finalRefreshToken,
        userId: finalUserId,
        profiles: profiles || [{ id: 1, name: 'Default', isPrimary: true }],
        activeProfileId: initialAccount?.activeProfileId || 1,
        lastSyncedAt: new Date().toISOString(),
      };

      setSuccessMessage('Account authenticated successfully!');
      setTimeout(() => {
        onSaveAccount(account);
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate account. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">
              {initialAccount ? 'Edit Managed Account' : 'Add New Managed Account'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Connect a managed Nuvio device or account
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Account Identifier / Nickname */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Friendly Label *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Living Room TV or Family Account"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Location / Region
              </label>
              <input
                type="text"
                placeholder="e.g. USA, UK, AU"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Auth Method Switch */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Authentication Method
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800/80 border border-slate-700/70 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setAuthMethod('password')}
                className={`py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  authMethod === 'password'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Email & Password</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthMethod('token')}
                className={`py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  authMethod === 'token'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Session JWT Token</span>
              </button>
            </div>
          </div>

          {authMethod === 'password' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nuvio Account Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="family@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Supabase Access Token (JWT) *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Paste Bearer JWT token from browser localStorage / cookies on nuvio.tv..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                You can copy this from browser DevTools → Application → Local Storage on nuvio.tv
              </p>
            </div>
          )}

          {/* Advanced Server Configuration */}
          <details className="text-xs pt-1 group">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-medium flex items-center space-x-1">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Advanced: Backend Server Configuration</span>
            </summary>
            <div className="mt-3 space-y-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Supabase URL (Default: Official)
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Supabase Anon Key
                </label>
                <input
                  type="text"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>
          </details>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-600/20 flex items-center space-x-2 transition-all"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{initialAccount ? 'Save Changes' : 'Connect Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
