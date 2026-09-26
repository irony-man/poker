'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FORM_LABEL_CLASS, TextField } from '@/components/ui/TextField';
import { CardLayoutEditor } from '@/features/admin/CardLayoutEditor';
import { parseCardPreviewCode, SUIT_LABEL } from '@/lib/cardCodeParse';
import {
  CARD_FACE_SNAP_STEPS,
  type CardFaceLayer,
  type CardFaceLayerKind,
  type CardFaceSnapStep,
  type CardFaceTheme,
  cloneCardFaceThemes,
  cloneLayers,
  copySuitLayers,
  defaultCardFaceThemes,
  MAX_CARD_FACE_LAYERS,
  MAX_CARD_FACE_THEMES,
  newCardFaceLayer,
  snapUnit,
  SUIT_KEYS,
  themeLayersForSuit,
  type SuitKey,
} from '@/lib/cardFaceTheme';
import { sanitizeCardFaceSvg } from '@/lib/cardFaceSvg';
import { ADMIN_SAVE_BTN, AdminInset, CheckboxRow, SaveBar, Section } from '../ui';

const SUIT_LABELS = SUIT_LABEL;
const SUIT_TAB: Record<SuitKey, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };

const PREVIEW_CODES = ['Ah', 'Ks', '10d', '2c'] as const;

function slugNewThemeId(existing: Set<string>): string {
  let n = 1;
  while (existing.has(`theme-${n}`)) n += 1;
  return `theme-${n}`;
}

export function CardPlaygroundSection({
  themes,
  busy,
  busyKey,
  onThemes,
  onSave,
}: {
  themes: CardFaceTheme[];
  busy: boolean;
  busyKey: string | null;
  onThemes: (next: CardFaceTheme[]) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  const [activeId, setActiveId] = useState(() => themes.find((t) => t.isDefault)?.id ?? themes[0]?.id ?? 'classic');
  const [selectedLayerId, setSelectedLayerId] = useState('rank');
  const [sampleCode, setSampleCode] = useState<(typeof PREVIEW_CODES)[number]>('Ah');
  const [editSuit, setEditSuit] = useState<SuitKey>('h');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapStep, setSnapStep] = useState<CardFaceSnapStep>(0.05);
  const [svgDraft, setSvgDraft] = useState('');

  const activeTheme = useMemo(
    () => themes.find((t) => t.id === activeId) ?? themes[0] ?? defaultCardFaceThemes()[0]!,
    [activeId, themes],
  );

  const activeLayers = useMemo(
    () => themeLayersForSuit(activeTheme, editSuit),
    [activeTheme, editSuit],
  );

  useEffect(() => {
    const p = parseCardPreviewCode(sampleCode);
    if (p.rank !== '?') setEditSuit(p.suitKey);
  }, [sampleCode]);

  useEffect(() => {
    if (activeLayers.some((l) => l.id === selectedLayerId)) return;
    setSelectedLayerId(activeLayers[0]?.id ?? 'rank');
  }, [activeLayers, selectedLayerId]);

  const selectedLayer = activeLayers.find((l) => l.id === selectedLayerId) ?? activeLayers[0]!;

  useEffect(() => {
    if (selectedLayer.kind === 'svg') {
      setSvgDraft(selectedLayer.svg ?? '');
    } else {
      setSvgDraft('');
    }
  }, [selectedLayer.id, selectedLayer.kind, selectedLayer.svg]);

  const replaceEditSuitLayers = useCallback(
    (layers: CardFaceLayer[]) => {
      onThemes(
        themes.map((t) =>
          t.id === activeTheme.id
            ? {
                ...t,
                layersBySuit: { ...t.layersBySuit, [editSuit]: layers },
              }
            : t,
        ),
      );
    },
    [activeTheme.id, editSuit, onThemes, themes],
  );

  const updateActive = useCallback(
    (patch: Partial<CardFaceTheme>) => {
      onThemes(
        themes.map((t) =>
          t.id === activeTheme.id
            ? {
                ...t,
                ...patch,
                layersBySuit: patch.layersBySuit ?? t.layersBySuit,
                suitColors: patch.suitColors ?? t.suitColors,
              }
            : t,
        ),
      );
    },
    [activeTheme.id, onThemes, themes],
  );

  const updateLayer = useCallback(
    (layerId: string, patch: Partial<CardFaceLayer>) => {
      replaceEditSuitLayers(
        activeLayers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      );
    },
    [activeLayers, replaceEditSuitLayers],
  );

  const applySnap = useCallback(
    (value: number) => (snapEnabled ? snapUnit(value, snapStep) : value),
    [snapEnabled, snapStep],
  );

  const setNumeric = (field: 'x' | 'y' | 'size', raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const value = applySnap(n / 100);
    updateLayer(selectedLayer.id, { [field]: value });
  };

  function addLayer(kind: CardFaceLayerKind, svgMarkup?: string) {
    if (activeLayers.length >= MAX_CARD_FACE_LAYERS) return;
    const layer = newCardFaceLayer(kind, activeLayers.map((l) => l.id), svgMarkup);
    replaceEditSuitLayers([...activeLayers, layer]);
    setSelectedLayerId(layer.id);
  }

  function applySvgDraft() {
    const svg = sanitizeCardFaceSvg(svgDraft);
    if (!svg) return;
    updateLayer(selectedLayer.id, { kind: 'svg', svg });
  }

  async function onSvgFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const svg = sanitizeCardFaceSvg(text);
    if (!svg) return;
    if (selectedLayer.kind === 'svg') {
      updateLayer(selectedLayer.id, { svg });
      setSvgDraft(svg);
    } else {
      addLayer('svg', svg);
    }
  }

  function layerKindLabel(kind: CardFaceLayerKind): string {
    if (kind === 'rank') return 'Rank';
    if (kind === 'svg') return 'SVG';
    return 'Suit';
  }

  function deleteLayer(layerId: string) {
    if (activeLayers.length <= 1) return;
    const next = activeLayers.filter((l) => l.id !== layerId);
    replaceEditSuitLayers(next);
    if (selectedLayerId === layerId) {
      setSelectedLayerId(next[0]!.id);
    }
  }

  function copyLayoutFrom(source: SuitKey) {
    if (source === editSuit) return;
    updateActive({ layersBySuit: copySuitLayers(activeTheme.layersBySuit, source, editSuit) });
  }

  function duplicateTheme() {
    if (themes.length >= MAX_CARD_FACE_THEMES) return;
    const ids = new Set(themes.map((t) => t.id));
    const id = slugNewThemeId(ids);
    const copy: CardFaceTheme = {
      ...activeTheme,
      id,
      name: `${activeTheme.name} copy`,
      isDefault: false,
      suitColors: { ...activeTheme.suitColors },
      layersBySuit: {
        h: cloneLayers(activeTheme.layersBySuit.h),
        d: cloneLayers(activeTheme.layersBySuit.d),
        c: cloneLayers(activeTheme.layersBySuit.c),
        s: cloneLayers(activeTheme.layersBySuit.s),
      },
    };
    onThemes([...themes, copy]);
    setActiveId(id);
  }

  function addTheme() {
    if (themes.length >= MAX_CARD_FACE_THEMES) return;
    const ids = new Set(themes.map((t) => t.id));
    const id = slugNewThemeId(ids);
    const base = defaultCardFaceThemes()[0]!;
    onThemes([
      ...themes,
      {
        ...base,
        id,
        name: `New theme ${themes.length + 1}`,
        isDefault: false,
        layersBySuit: {
          h: cloneLayers(base.layersBySuit.h),
          d: cloneLayers(base.layersBySuit.d),
          c: cloneLayers(base.layersBySuit.c),
          s: cloneLayers(base.layersBySuit.s),
        },
      },
    ]);
    setActiveId(id);
  }

  function removeTheme() {
    if (themes.length <= 1) return;
    const next = themes.filter((t) => t.id !== activeTheme.id);
    const withDefault = next.some((t) => t.isDefault)
      ? next
      : next.map((t, i) => ({ ...t, isDefault: i === 0 }));
    onThemes(withDefault);
    setActiveId(withDefault.find((t) => t.isDefault)?.id ?? withDefault[0]!.id);
  }

  function setDefault() {
    onThemes(themes.map((t) => ({ ...t, isDefault: t.id === activeTheme.id })));
  }

  async function copyJson() {
    const text = JSON.stringify(themes, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <Section
      title="Card face playground"
      description="Edit layout per suit (♥♦♣♠), copy from another suit, or use preview tabs including 10d. Save to publish."
    >
      <form onSubmit={onSave} className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1">
            <span className={FORM_LABEL_CLASS}>Editing theme</span>
            <select
              className="mt-1 w-full rounded-lg border border-sidebar/15 bg-page px-3 py-2 text-sm"
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Theme name"
            value={activeTheme.name}
            onChange={(e) => updateActive({ name: e.target.value })}
            className="min-w-[10rem] flex-1"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={addTheme} disabled={themes.length >= MAX_CARD_FACE_THEMES}>
              New
            </Button>
            <Button type="button" variant="ghost" onClick={duplicateTheme} disabled={themes.length >= MAX_CARD_FACE_THEMES}>
              Duplicate
            </Button>
            <Button type="button" variant="ghost" onClick={setDefault}>
              Set default
            </Button>
            <Button type="button" variant="ghost" onClick={removeTheme} disabled={themes.length <= 1}>
              Delete theme
            </Button>
            <Button type="button" variant="ghost" onClick={() => void copyJson()}>
              Copy JSON
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <AdminInset className="space-y-4 p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Layout suit</p>
              <div className="flex flex-wrap gap-1.5">
                {SUIT_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditSuit(key)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      editSuit === key ? 'bg-sidebar text-white' : 'bg-sidebar/8 text-sidebar'
                    }`}
                    title={SUIT_LABELS[key]}
                  >
                    {SUIT_TAB[key]} {SUIT_LABELS[key]}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className={FORM_LABEL_CLASS}>Copy layout from</span>
                <select
                  className="mt-1 w-full rounded-lg border border-sidebar/15 bg-page px-3 py-2 text-sm"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value as SuitKey;
                    if (v) copyLayoutFrom(v);
                    e.target.value = '';
                  }}
                >
                  <option value="">Choose another suit…</option>
                  {SUIT_KEYS.filter((k) => k !== editSuit).map((key) => (
                    <option key={key} value={key}>
                      {SUIT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Layers</p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="soft"
                  className="min-h-8 px-2.5 text-xs"
                  disabled={activeLayers.length >= MAX_CARD_FACE_LAYERS}
                  onClick={() => addLayer('rank')}
                >
                  + Rank
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  className="min-h-8 px-2.5 text-xs"
                  disabled={activeLayers.length >= MAX_CARD_FACE_LAYERS}
                  onClick={() => addLayer('suit')}
                >
                  + Suit
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  className="min-h-8 px-2.5 text-xs"
                  disabled={activeLayers.length >= MAX_CARD_FACE_LAYERS}
                  onClick={() => addLayer('svg')}
                >
                  + SVG
                </Button>
              </div>
            </div>
            <ul className="space-y-1">
              {activeLayers.map((layer) => (
                <li key={layer.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedLayerId === layer.id
                        ? 'bg-sidebar/10 font-semibold text-sidebar'
                        : 'hover:bg-sidebar/[0.04]'
                    }`}
                  >
                    <span className="block truncate">{layer.name}</span>
                    <span className="block text-xs font-normal text-muted">
                      {layerKindLabel(layer.kind)}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-9 shrink-0 px-2 text-xs text-muted hover:text-danger"
                    disabled={activeLayers.length <= 1}
                    onClick={() => deleteLayer(layer.id)}
                    aria-label={`Delete ${layer.name}`}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>

            <TextField
              label="Layer name"
              value={selectedLayer.name}
              onChange={(e) => updateLayer(selectedLayer.id, { name: e.target.value.slice(0, 48) })}
            />

            <label className="block">
              <span className={FORM_LABEL_CLASS}>Opacity</span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((selectedLayer.opacity ?? 1) * 100)}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, {
                      opacity: Math.min(1, Math.max(0, Number(e.target.value) / 100)),
                    })
                  }
                  className="min-w-0 flex-1"
                />
                <span className="w-10 text-right text-sm tabular-nums text-muted">
                  {Math.round((selectedLayer.opacity ?? 1) * 100)}%
                </span>
              </div>
            </label>

            {selectedLayer.kind === 'svg' ? (
              <div className="space-y-2">
                <label className="block">
                  <span className={FORM_LABEL_CLASS}>SVG markup</span>
                  <textarea
                    value={svgDraft}
                    onChange={(e) => setSvgDraft(e.target.value)}
                    rows={6}
                    spellCheck={false}
                    className="mt-1 w-full rounded-lg border border-sidebar/15 bg-page px-3 py-2 font-mono text-xs leading-relaxed"
                    placeholder="<svg ...>...</svg>"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="soft" className="min-h-9 text-xs" onClick={applySvgDraft}>
                    Apply SVG
                  </Button>
                  <label className="inline-flex cursor-pointer items-center">
                    <input
                      type="file"
                      accept=".svg,image/svg+xml"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        void onSvgFile(f);
                      }}
                    />
                    <span className="inline-flex min-h-9 items-center rounded-lg border border-sidebar/15 bg-page px-3 text-xs font-semibold text-sidebar hover:bg-sidebar/[0.04]">
                      Upload .svg
                    </span>
                  </label>
                </div>
                <p className="text-xs text-muted">Uses currentColor for tint. Scripts and unsafe tags are stripped on save.</p>
              </div>
            ) : null}

            <div className="space-y-2 border-t border-sidebar/8 pt-3">
              <CheckboxRow
                checked={snapEnabled}
                onChange={setSnapEnabled}
                title="Snap positions to grid"
                hint="Drag and numeric X/Y/size snap to the grid on the artboard."
              />
              <label className="block">
                <span className={FORM_LABEL_CLASS}>Snap increment</span>
                <select
                  className="mt-1 w-full rounded-lg border border-sidebar/15 bg-page px-3 py-2 text-sm"
                  value={snapStep}
                  disabled={!snapEnabled}
                  onChange={(e) => setSnapStep(Number(e.target.value) as CardFaceSnapStep)}
                >
                  {CARD_FACE_SNAP_STEPS.map((step) => (
                    <option key={step} value={step}>
                      {step * 100}% ({step === 0.02 ? 'fine' : step === 0.05 ? 'medium' : 'coarse'})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Suit colors</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(SUIT_LABELS) as (keyof typeof SUIT_LABELS)[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="color"
                    value={activeTheme.suitColors[key]}
                    onChange={(e) =>
                      updateActive({
                        suitColors: { ...activeTheme.suitColors, [key]: e.target.value.toUpperCase() },
                      })
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-sidebar/15"
                  />
                  <span>{SUIT_LABELS[key]}</span>
                </label>
              ))}
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Selection</p>
            <div className="grid grid-cols-3 gap-2">
              <TextField
                label="X %"
                type="number"
                step={0.5}
                min={0}
                max={100}
                value={Math.round(selectedLayer.x * 1000) / 10}
                onChange={(e) => setNumeric('x', e.target.value)}
              />
              <TextField
                label="Y %"
                type="number"
                step={0.5}
                min={0}
                max={100}
                value={Math.round(selectedLayer.y * 1000) / 10}
                onChange={(e) => setNumeric('y', e.target.value)}
              />
              <TextField
                label="Size % H"
                type="number"
                step={0.5}
                min={2}
                max={80}
                value={Math.round(selectedLayer.size * 1000) / 10}
                onChange={(e) => setNumeric('size', e.target.value)}
              />
            </div>
          </AdminInset>

          <AdminInset className="flex flex-col items-center gap-4 p-6">
            <div className="flex flex-wrap justify-center gap-2">
              {PREVIEW_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSampleCode(code)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    sampleCode === code ? 'bg-sidebar text-white' : 'bg-sidebar/8 text-sidebar'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <CardLayoutEditor
              theme={activeTheme}
              layers={activeLayers}
              suitKey={editSuit}
              sampleCode={sampleCode}
              selectedLayerId={selectedLayer.id}
              snapEnabled={snapEnabled}
              snapStep={snapStep}
              onSelect={setSelectedLayerId}
              onChangeLayer={updateLayer}
            />
            <p className="max-w-xs text-center text-xs text-muted">
              Positions are normalized to the card face so every table size scales like a Canva artboard.
            </p>
          </AdminInset>
        </div>

        <SaveBar>
          <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
            {busyKey === 'cards' ? 'Saving…' : 'Save card themes'}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}

export function cloneThemesForAdmin(themes: CardFaceTheme[]): CardFaceTheme[] {
  return cloneCardFaceThemes(themes);
}
