'use client';

import { useEffect, useRef } from 'react';

export type ChipStates = {
  role: boolean;
  location: boolean;
  companySize: boolean;
  industry: boolean;
  experienceLevel: boolean;
  skills: boolean;
};

export function useChipExtractor(input: string, onUpdate: (s: ChipStates) => void) {
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);

    // Reset when empty/very short
    if (!input || input.trim().length < 2) {
      onUpdate({
        role: false, 
        location: false, 
        companySize: false,
        industry: false, 
        experienceLevel: false, 
        skills: false
      });
      return;
    }

    timerRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch('/api/parseChips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: input }),
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = await res.json();

        // map a few synonyms from the API just in case
        onUpdate({
          role: !!(data.role || data.title),
          location: !!data.location,
          companySize: !!(data.company_size || data.companySize || data.org_size),
          industry: !!(data.industry || data.company_or_industry),
          experienceLevel: !!(data.experience_level || data.seniority),
          skills: !!(Array.isArray(data.skills) ? data.skills.length : data.skills),
        });
      } catch {
        // silent fail: keep last state
      }
    }, 300); // debounce

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [input, onUpdate]);
}
