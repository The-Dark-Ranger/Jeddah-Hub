'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    grecaptcha: any;
    __rcOnLoad?: () => void;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export default function ReCaptcha({ onVerify, onExpire }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const verifyRef = useRef(onVerify);
  const expireRef = useRef(onExpire);
  verifyRef.current = onVerify;
  expireRef.current = onExpire;

  useEffect(() => {
    if (!SITE_KEY || !divRef.current) return;

    const doRender = () => {
      if (!divRef.current || widgetId.current !== null) return;
      widgetId.current = window.grecaptcha.render(divRef.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => verifyRef.current(t),
        'expired-callback': () => expireRef.current?.(),
      });
    };

    if (typeof window.grecaptcha?.render === 'function') {
      doRender();
    } else {
      const prev = window.__rcOnLoad;
      window.__rcOnLoad = () => { prev?.(); doRender(); };
      if (!document.querySelector('script[data-recaptcha-v2]')) {
        const s = document.createElement('script');
        s.src = 'https://www.google.com/recaptcha/api.js?onload=__rcOnLoad&render=explicit';
        s.async = true;
        s.defer = true;
        s.dataset.recaptchaV2 = '1';
        document.head.appendChild(s);
      }
    }

    return () => {
      if (widgetId.current !== null) {
        try { window.grecaptcha?.reset(widgetId.current); } catch { /* noop */ }
        widgetId.current = null;
      }
    };
  }, []);

  return <div ref={divRef} />;
}
