import React, { useState, useEffect, useRef } from 'react';
import { X, Key } from 'lucide-react';
import { buildBookmarklet, buildHelperSource } from '../../helper/keyHelper';
import { copyText } from '../../services/clipboard';
import { validateAnonKey, maskKey, reasonToPlainEnglish } from '../../services/anonKey';
import { loadServerSettings, saveServerSettings, clearServerSettings } from '../../services/serverSettings';
import { toErrorMessage } from '../../services/errors';

interface GetKeyViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GetKeyView: React.FC<GetKeyViewProps> = ({ isOpen, onClose }) => {
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [manualKey, setManualKey] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const helperSource = buildHelperSource(location.origin);

  // Load the saved key when the view opens.
  useEffect(() => {
    if (isOpen) {
      const settings = loadServerSettings();
      setSavedKey(settings ? settings.supabaseAnonKey : null);
    }
  }, [isOpen]);

  // React 19 blocks javascript: URLs as rendered href props, so set the
  // bookmarklet href through a ref in an effect.
  useEffect(() => {
    if (isOpen && linkRef.current) {
      linkRef.current.setAttribute('href', buildBookmarklet(location.origin));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = () => {
    if (window.confirm('Remove the saved Nuvio key from this browser?')) {
      clearServerSettings();
      setSavedKey(null);
    }
  };

  const handleCopy = async () => {
    const ok = await copyText(helperSource);
    setCopyStatus(ok ? 'copied' : 'failed');
  };

  const handleSaveManual = () => {
    const validation = validateAnonKey(manualKey);
    if (!validation.ok) {
      setManualError(reasonToPlainEnglish(validation.reason));
      return;
    }
    try {
      saveServerSettings(validation.key);
      setSavedKey(validation.key);
      setManualError(null);
      setManualKey('');
    } catch (err) {
      setManualError(toErrorMessage(err, 'Could not save the key in this browser.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Get the Nuvio Key</h2>
          </div>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Current status */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">
              {savedKey ? `Key saved: ${maskKey(savedKey)}` : 'No key saved'}
            </span>
            {savedKey && (
              <button
                onClick={handleRemove}
                className="text-rose-400 hover:text-rose-300 font-medium"
              >
                Remove
              </button>
            )}
          </div>

          <p className="text-slate-500">
            It only looks for Nuvio's public client key on the nuvio.tv page. It does not read your login, cookies or passwords.
          </p>

          {/* Step 1 */}
          <div className="space-y-1">
            <div className="font-semibold text-slate-200">Step 1</div>
            <a
              ref={linkRef}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-blue-400 hover:text-blue-300 underline font-medium"
            >
              Nuvio key helper
            </a>
            <span className="text-slate-400">Drag this to your bookmarks bar</span>
          </div>

          {/* Step 2 */}
          <div className="space-y-1">
            <div className="font-semibold text-slate-200">Step 2</div>
            <span className="text-slate-400">
              Open{' '}
              <a
                href="https://nuvio.tv"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                nuvio.tv
              </a>
              , sign in if you like, then click the bookmark.
            </span>
          </div>

          {/* Step 3 */}
          <div className="space-y-1">
            <div className="font-semibold text-slate-200">Step 3</div>
            <span className="text-slate-400">You will come back here with the key saved.</span>
          </div>

          {/* If bookmarks are blocked */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-200">If bookmarks are blocked</div>
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all"
            >
              Copy snippet
            </button>
            <span className="text-slate-400">Open nuvio.tv, press F12, open Console, paste, Enter</span>
            {copyStatus === 'copied' && <span className="text-emerald-400">Copied</span>}
            {copyStatus === 'failed' && (
              <span className="text-rose-400">Could not copy; select the text below</span>
            )}
            <textarea
              readOnly
              value={helperSource}
              rows={3}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300"
            />
          </div>

          {/* Manual paste */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-200">Manual paste</div>
            <input
              type="password"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              placeholder="Paste the anon key"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {manualError && <span className="text-rose-400">{manualError}</span>}
            <button
              onClick={handleSaveManual}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all"
            >
              Save key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
