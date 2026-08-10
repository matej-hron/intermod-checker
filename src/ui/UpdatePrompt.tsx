import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    /* The live region stays mounted and its contents change in place. A region
       that appears with content already inside it is not reliably announced,
       which would leave the prompt invisible to a screen reader. */
    <div className="update-prompt-region" role="status">
      {needRefresh && (
        <div className="update-prompt">
          <span>A new version is ready.</span>
          <button
            type="button"
            className="btn--primary"
            onClick={() => void updateServiceWorker(true)}
          >
            Reload
          </button>
          <button type="button" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </div>
      )}
    </div>
  );
}
