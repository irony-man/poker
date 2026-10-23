'use client';

import { useState } from 'react';
import { PkScope } from '@/components/pk/PkScope';
import { PkButton } from '@/components/pk/Button';
import { PkTextField, PkToggle, PkCheck } from '@/components/pk/TextField';
import { PkCodeInput } from '@/components/pk/CodeInput';
import { PkSegmented, PkStakeCards, PkSelect } from '@/components/pk/Choice';
import { PkBadge, PkChipStack, PkEmpty, PkPageHeader, PkSkeleton, pkToast } from '@/components/pk/Bits';
import { PkDialog } from '@/components/pk/Overlay';

export default function DevPkPage() {
  const [code, setCode] = useState('');
  const [stake, setStake] = useState('low');
  const [seats, setSeats] = useState('6');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <PkScope>
      <div className="mx-auto flex max-w-3xl flex-col gap-pk-6 px-pk-4 py-pk-6">
        <PkPageHeader title="Poker components" subtitle="Dev gallery. Not linked from the app." />
        <div className="flex flex-wrap gap-pk-2">
          <PkButton>Primary</PkButton>
          <PkButton variant="secondary">Secondary</PkButton>
          <PkButton variant="ghost">Ghost</PkButton>
          <PkButton variant="danger">Danger</PkButton>
          <PkButton variant="icon" aria-label="Icon">
            +
          </PkButton>
        </div>
        <PkTextField label="Table name" name="table" placeholder="Friday night" />
        <PkTextField label="Password" name="password" type="password" error="Too short" />
        <PkCodeInput value={code} onChange={setCode} />
        <PkStakeCards selected={stake} onSelect={setStake} />
        <PkSegmented
          label="Seats"
          value={seats}
          onChange={setSeats}
          options={['2', '6', '9'].map((id) => ({ id, label: id }))}
        />
        <PkSelect
          label="Pack"
          value="a"
          onChange={() => undefined}
          options={[
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ]}
        />
        <PkToggle checked={on} onChange={setOn} label="Sound" />
        <PkCheck checked={checked} onChange={setChecked} label="Ready" />
        <div className="flex gap-pk-2">
          <PkBadge tone="new">New</PkBadge>
          <PkBadge tone="live">Live</PkBadge>
          <PkBadge tone="free">Seats free</PkBadge>
          <PkChipStack amount={240} />
        </div>
        <PkSkeleton className="h-16" />
        <PkEmpty title="Nothing here" body="Empty state used by analysis." />
        <PkButton
          onClick={() => {
            pkToast('info', 'Saved');
            setOpen(true);
          }}
        >
          Open dialog
        </PkButton>
        <PkDialog open={open} title="Dialog" onClose={() => setOpen(false)}>
          <p>Focus stays in this dialog until you close it.</p>
        </PkDialog>
      </div>
    </PkScope>
  );
}
