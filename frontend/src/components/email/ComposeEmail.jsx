import { useState } from 'react';

export default function ComposeEmail({ onClose }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="glass p-8 rounded-2xl shadow-glass w-full max-w-lg animate-fade-in">
        <h2 className="text-xl font-bold text-primary mb-4">Compose Email</h2>
        <form className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="To"
            className="glass bg-glass px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
          <input
            type="text"
            placeholder="Subject"
            className="glass bg-glass px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
          <textarea
            placeholder="Message..."
            className="glass bg-glass px-4 py-2 rounded-lg min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary transition"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="bg-primary hover:bg-primaryDark text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-glass"
            >
              Send
            </button>
            <button
              type="button"
              className="bg-backgroundSoft text-textDark border borderLight py-2 px-6 rounded-lg hover:bg-background transition"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
