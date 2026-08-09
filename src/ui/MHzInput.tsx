import { useState } from 'react';
import { kHzToMHzText, mhzToKHz, parseFrequencyMHz } from '../im';

/**
 * A megahertz text field over a kilohertz store value.
 *
 * While the user types, the raw keystrokes live in `draft` and the store is
 * left alone: committing per keystroke would reformat a half-typed "510.125"
 * the moment "51" parsed. Once `draft` clears, the field renders the store
 * value again, so an external change (reset, project load, applied
 * suggestion) is reflected in a field the user is not editing.
 */
export function MHzInput({
  valueKHz,
  onCommit,
  label,
  id,
}: {
  valueKHz: number;
  onCommit: (khz: number) => void;
  label: string;
  id?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const commit = (): void => {
    if (draft === null) return;
    const parsed = parseFrequencyMHz(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    onCommit(mhzToKHz(parsed));
    setDraft(null);
    setInvalid(false);
  };

  return (
    <input
      id={id}
      className={invalid ? 'freq-input freq-input--invalid' : 'freq-input'}
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      value={draft ?? kHzToMHzText(valueKHz)}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}
