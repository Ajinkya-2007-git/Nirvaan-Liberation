// A phone number with two actions next to it: a call button (a
// plain tel: link — tapping it already triggers the phone's own
// "choose an app to call with" system dialog on most phones, we
// don't need to build that ourselves) and a copy button, since
// sometimes an admin wants to paste a number into a separate
// messaging app rather than call it directly from here.

import { useState } from 'react';
import { Phone, Copy, Check } from 'lucide-react';

interface PhoneActionsProps {
  phone: string;
  // Optional — shown before the number/buttons, e.g. "Reporter" or
  // "Volunteer." Left out entirely when not provided.
  label?: string;
}

export function PhoneActions({ phone, label }: PhoneActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(phone);
    setCopied(true);
    // Reverts the checkmark back to the copy icon after a couple of
    // seconds — a permanent checkmark would look like a stuck/broken
    // button the next time someone glances at it.
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-muted">{label}: </span>}
      <span className="font-data text-paper">{phone}</span>
      <a
        href={`tel:${phone}`}
        aria-label={`Call ${phone}`}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-signal hover:border-signal"
      >
        <Phone size={12} />
      </a>
      <button
        onClick={handleCopy}
        aria-label={`Copy ${phone}`}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-muted hover:border-signal hover:text-signal"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}
