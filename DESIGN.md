---
name: Telemetry Command Center
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dce6'
  primary: '#e0fdff'
  on-primary: '#00373a'
  primary-container: '#00f2fe'
  on-primary-container: '#006a70'
  inverse-primary: '#00696f'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#e1ffec'
  on-tertiary: '#003824'
  tertiary-container: '#67f4b7'
  on-tertiary-container: '#006e4b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ff6ff'
  primary-fixed-dim: '#00dce6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '700'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: 0.01em
  metric-display:
    fontFamily: JetBrains Mono
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2rem
    letterSpacing: -0.03em
  metric-display-mobile:
    fontFamily: JetBrains Mono
    fontSize: 1.25rem
    fontWeight: '700'
    lineHeight: 1.5rem
    letterSpacing: -0.02em
  telemetry-data:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.08em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  gutter-dense: 0.5rem
  gutter-normal: 0.75rem
  panel-padding: 1rem
---

## Brand & Style

This design system delivers a mission-critical, high-density operations experience engineered for Network Operations Centers (NOC), IoT fleet controllers, and distributed infrastructure engineers. The visual identity establishes an aura of relentless precision, situational awareness, and technological superiority. 

The design language synthesizes **tactical minimalism** with **restrained cyber-futurism**:
- Deep void backdrops minimize retinal fatigue during continuous 12-hour monitoring shifts.
- Laser-focused neon accents prioritize visual triage, directing operator cognition immediately toward anomalies, degraded nodes, and incident escalation paths.
- Crisp vector edges, subtle glowing container borders, and monospaced telemetry readouts reinforce an environment of low latency and surgical accuracy.
- Visual noise is strictly eliminated: decorative embellishments are prohibited in favor of functional density, micro-sparklines, and live state indications.

## Colors

The palette relies on a deep stratified obsidian base punctuated by luminous spectral signals. Color serves primarily as semantic status and data hierarchy rather than decoration.

### Surface Architecture
- **Base Canvas (`#0B0F17`):** The foundational substrate representing negative space and system idling.
- **Surface Elevation 1 (`#111827`):** Background for primary panels, structural sidebars, and control ribbons.
- **Surface Elevation 2 (`#1A2234`):** Cards, widget containers, and nested telemetry blocks.
- **Surface Interactive (`#243048`):** Hover states, active list selections, and interactive wells.

### Semantic Telemetry Signals
- **Primary / Active Command (`#00F2FE` & `#06B6D4`):** Electric cyan accents for active selections, interactive highlights, data streams, and primary triggers.
- **Operational / Optimal (`#10B981`):** Emerald green indicating healthy nodes, nominal heartbeat signals, and resolved incidents.
- **Warning / Degraded (`#F59E0B`):** Radiant amber for memory pressure, thermal warnings, packet drop thresholds, and transient anomalies.
- **Critical / Failure (`#F43F5E`):** Vivid rose-red dedicated strictly to outages, breached SLAs, security anomalies, and hard disconnects.

### Border & Luminescence
- **Border Default:** `rgba(148, 163, 184, 0.08)` for structural grid containment.
- **Border Active / Glowing:** `rgba(0, 242, 254, 0.35)` paired with a soft edge bloom to denote selected nodes or active hardware slots.

## Typography

The typographic engine balances rapid human scanning with machine-level precision through a dual-type system:

1. **Interface Layer (`Inter`):** Handles narrative headers, control panel labels, form inputs, and modal titles. Characterized by neutral geometry and high legibility at micro scales.
2. **Telemetry & Metric Layer (`JetBrains Mono`):** Dedicated to raw data, IP addresses, throughput figures, latency gauges, timestamps, and hex logs. Tabular numerals ensure vertical tabular alignment across dynamically updating feeds.

All operational labels (`label-caps`) must be rendered in uppercase with expanded letter spacing (`0.08em`) to guarantee quick peripheral scanning across large multi-monitor wall mounts.

## Layout & Spacing

The layout is built around a full-viewport, zero-bleed dashboard architecture designed to display maximum telemetry without unnecessary scrolling.

### Grid & Density Rules
- **Structure:** 12-column or 24-column variable-density fluid grid.
- **Base Rhythm:** Compact 4px / 8px scale. Dense panels use `0.5rem` (8px) internal spacing to pack charts, metrics, and micro-sparklines side-by-side.
- **Reflow & Breakpoints:**
  - **Desktop / Video Wall (>= 1440px):** Multi-column tiled matrix with synchronized side-docked event streams. Fixed heights with independent panel scroll regions.
  - **Laptop / Workstation (1024px – 1439px):** Collapsible ancillary sidebars; secondary telemetry metrics convert into tabbed switchers.
  - **Mobile / Tablet (< 1024px):** Single-column stacked telemetry cards, persistent bottom alarm bar, sticky status filter chips.

## Elevation & Depth

Depth in this design system avoids heavy drop shadows, instead using **surface stratification, luminous borders, and controlled optical blurs**.

1. **Substrate & Panels:**
   - Background canvas: `#0B0F17`.
   - Cards and structural sections: `#111827` overlaid with an inner border of `1px solid rgba(148, 163, 184, 0.08)`.
2. **Selected & Alert States (Glow Depth):**
   - Active widgets receive an elevated border: `1px solid rgba(0, 242, 254, 0.5)`.
   - Glowing aura: `box-shadow: 0 0 12px -2px rgba(0, 242, 254, 0.25), inset 0 0 8px 0 rgba(0, 242, 254, 0.05)`.
   - Incident cards in Critical state swap to: `box-shadow: 0 0 16px -2px rgba(244, 63, 94, 0.35), inset 0 0 12px 0 rgba(244, 63, 94, 0.08)`.
3. **Overlays & Drawers:**
   - Modals, flyout diagnostic consoles, and tooltips utilize `rgba(17, 24, 39, 0.85)` backed by `backdrop-filter: blur(12px)` and framed with `1px solid rgba(0, 242, 254, 0.2)`.

## Shapes

The design system uses a strict **Soft (`roundedness: 1`)** profile. 
- Standard components, metric badges, and interactive controls adhere to a precise `0.25rem` (4px) corner radius.
- Larger surface cards, chart containers, and viewport panels scale to `0.5rem` (8px).
- Status indicator pills and live ping dots are strictly circular (`9999px`).

Overly rounded contours are eliminated to avoid wasting display space and preserve an engineered, instrument-grade appearance.

## Components

### Buttons & Action Triggers
- **Primary Action:** Solid background with `#00F2FE`, foreground `#0B0F17` (bold weight). Focus/hover invokes a `0 0 12px rgba(0, 242, 254, 0.4)` cyan halo.
- **Tactical Outline (Secondary):** Transparent background, border `1px solid rgba(0, 242, 254, 0.4)`, text `#00F2FE`. On hover: surface tints to `rgba(0, 242, 254, 0.1)`.
- **Destructive/Override:** Background `rgba(244, 63, 94, 0.12)`, border `1px solid #F43F5E`, text `#F43F5E`.
- **Dimensions:** Compact 28px and 32px heights to optimize spatial conservation.

### Telemetry Cards & High-Density Containers
- **Header:** Uppercase `label-caps` in `#94A3B8`, accompanied by an inline status beacon (glowing circular dot).
- **Body:** Dominant metric in `metric-display` JetBrains Mono, supported by delta indicators (e.g., `+2.4%`, `#10B981`).
- **Footer / Sparkline Well:** Directly integrates SVG micro-sparklines or bar distributions with area gradients fading from accent color to full transparency.

### Status Indicators & Chips
- Embedded inline or floating top-right within cards.
- **Online:** Beacon pulse dot `#10B981` with an outer ping keyframe ring `rgba(16, 185, 129, 0.3)`. Text label `#10B981` on `rgba(16, 185, 129, 0.1)` capsule.
- **Warning:** `#F59E0B` static indicator with subtle glow.
- **Critical:** `#F43F5E` with continuous rapid alert pulse.

### Form Inputs & Search Filters
- **Input Fields:** Dark fill `#0B0F17`, stroke `1px solid rgba(148, 163, 184, 0.15)`, text `#F8FAFC`.
- **Focus State:** Stroke sharpens to `#00F2FE` with box shadow `0 0 0 1px #00F2FE`.
- **Placeholder:** Monospaced muted slate `#64748B`.

### Checkboxes & Toggle Switches
- **Checkboxes:** Squared 14px boxes, border `1px solid rgba(148, 163, 184, 0.3)`. Checked state displays `#00F2FE` solid fill with black checkmark icon.
- **Toggle Switches:** Miniaturized 28px width track in `#1A2234`. Thumb slides to reveal cyan active track `#06B6D4`.

### Real-Time Logs & Incident Tables
- **Header:** Sticky `#111827`, border-bottom `1px solid rgba(148, 163, 184, 0.1)`.
- **Row:** Alternating subtle zebra striping (`rgba(255, 255, 255, 0.01)`), height 32px.
- **Font:** Rendered in `telemetry-data` with exact tabular number widths.
- **Hover:** Complete row illuminates in `rgba(0, 242, 254, 0.05)` with an active left edge cyan border indicator (2px width).