import { useRef } from 'react';

type Author = {
  name: string;
  url: string;
};

const AUTHORS: readonly Author[] = [
  { name: 'Ivan Horak', url: 'https://www.linkedin.com/in/ivan-horak-97245919b/' },
  { name: 'Matej Hron', url: 'https://www.linkedin.com/in/matejhron/' },
];

export function AboutSheet() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="btn--ghost about__trigger"
        onClick={() => dialog.current?.showModal()}
      >
        About &amp; credits
      </button>

      <dialog ref={dialog} className="sheet sheet--tall" aria-label="About">
        <div className="sheet__body">
          <div className="sheet__header">
            <h2>About</h2>
            <button
              type="button"
              className="btn--primary"
              onClick={() => dialog.current?.close()}
            >
              Done
            </button>
          </div>

          <p>
            Intermodulation Checker helps you pick wireless microphone
            frequencies that do not interfere with one another. Enter the
            frequencies you plan to use and it reports the intermodulation
            products they generate, then suggests clear alternatives.
          </p>

          <h3 className="about__heading">Made by</h3>
          <ul className="about__authors">
            {AUTHORS.map((author) => (
              <li key={author.url}>
                <a href={author.url} target="_blank" rel="noopener noreferrer">
                  {author.name}
                  <span className="visually-hidden"> on LinkedIn</span>
                  <span aria-hidden="true"> ↗</span>
                </a>
              </li>
            ))}
          </ul>

          <p className="hint">
            Your frequencies stay in this browser — nothing is uploaded.
          </p>
        </div>
      </dialog>
    </>
  );
}
