import React, { useState, useCallback } from 'react';

export const GlassContact: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3800);
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        showToast('Name is required.');
        return;
      }
      const plain = `Name: ${name}\nPhone: ${phone || '—'}\n\n${comment}`;
      const subject = encodeURIComponent('CHRONOS GRID signal');
      const body = encodeURIComponent(plain);
      const mailto = `mailto:?subject=${subject}&body=${body}`;

      try {
        await navigator.clipboard.writeText(plain);
        showToast('Copied to clipboard. Opening mail if available…');
      } catch {
        showToast('Opening mail client…');
      }

      window.setTimeout(() => {
        window.location.href = mailto;
      }, 80);
    },
    [name, phone, comment, showToast],
  );

  return (
    <div className="ms-glass">
      <h3 className="ms-glass__title">Still hearing voices?</h3>
      <p className="ms-glass__sub">Leave a ping—signal only, no spoilers.</p>
      <form className="ms-glass__form" onSubmit={submit}>
        <label className="ms-glass__label">
          Name
          <input
            required
            className="ms-glass__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="ms-glass__label">
          Phone <span className="ms-glass__opt">(optional)</span>
          <input
            className="ms-glass__input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            pattern="[0-9+().\\-\\s]*"
          />
        </label>
        <label className="ms-glass__label">
          Comment
          <textarea
            className="ms-glass__textarea"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <button type="submit" className="ms-glass__submit">
          SEND SIGNAL
        </button>
      </form>
      {toast && <div className="ms-toast" role="status">{toast}</div>}
    </div>
  );
};
