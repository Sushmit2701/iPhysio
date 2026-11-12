import { useApp } from './app-context';
import { Icon } from './Icon';

export function Toast() {
  const { toastMsg, dismissToast } = useApp();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      {toastMsg && (
        <div key={toastMsg.id} className="anim-in pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink py-2 pl-4 pr-2 text-bg shadow-lg" role="status">
          <span className="grow text-[0.95rem]">{toastMsg.text}</span>
          {toastMsg.undo && (
            <button
              type="button"
              className="flex min-h-12 items-center gap-1 rounded-xl px-3 font-semibold"
              style={{ color: 'var(--accent-soft)' }}
              onClick={async () => {
                await toastMsg.undo?.();
                dismissToast();
              }}
            >
              <Icon name="undo" size={18} /> Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
