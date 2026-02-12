# Data Model: 004-improve-app-design

**Date**: 2026-02-11

> This feature is UI-only — no database schema changes. This document defines the **theme token structure** and **component interface contracts** that replace a traditional data model.

## Theme Token Structure

### Color Tokens (Semantic)

Each token exists in both `light` and `dark` variants.

| Token | Purpose | Light Value | Dark Value |
|-------|---------|-------------|------------|
| `primary` | Primary actions, active tab, links | `#007AFF` | `#0A84FF` |
| `primaryLight` | Primary tint backgrounds | `#E5F0FF` | `#0A3D6B` |
| `background` | Screen background | `#FFFFFF` | `#000000` |
| `surface` | Cards, elevated surfaces | `#F2F2F7` | `#1C1C1E` |
| `surfaceElevated` | Modals, bottom sheets | `#FFFFFF` | `#2C2C2E` |
| `text` | Primary text | `#000000` | `#FFFFFF` |
| `textSecondary` | Secondary/muted text | `#8E8E93` | `#98989D` |
| `textTertiary` | Placeholder text | `#C7C7CC` | `#48484A` |
| `border` | Dividers, input borders | `#C6C6C8` | `#38383A` |
| `borderLight` | Subtle separators | `#E5E5EA` | `#2C2C2E` |
| `success` | Completed status, positive | `#34C759` | `#30D158` |
| `danger` | Delete, error, destructive | `#FF3B30` | `#FF453A` |
| `warning` | Warning states | `#FF9500` | `#FF9F0A` |
| `info` | Informational states | `#5856D6` | `#5E5CE6` |
| `tabBarBackground` | Tab bar background | `#FFFFFF` | `#1C1C1E` |
| `tabBarBorder` | Tab bar top border | `#C6C6C8` | `#38383A` |
| `tabBarActive` | Active tab icon/label | `#007AFF` | `#0A84FF` |
| `tabBarInactive` | Inactive tab icon/label | `#8E8E93` | `#636366` |
| `skeleton` | Skeleton loader base | `#E5E5EA` | `#2C2C2E` |
| `skeletonHighlight` | Skeleton loader shimmer | `#F2F2F7` | `#3A3A3C` |
| `overlay` | Modal/sheet backdrop | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` |

### Typography Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `h1` | 28 | `700` (Bold) | 34 | Screen titles |
| `h2` | 22 | `600` (Semibold) | 28 | Section headers |
| `h3` | 18 | `600` (Semibold) | 24 | Card titles, subsection headers |
| `body` | 16 | `400` (Regular) | 22 | Primary body text |
| `bodySmall` | 14 | `400` (Regular) | 20 | Secondary text, descriptions |
| `caption` | 12 | `400` (Regular) | 16 | Timestamps, metadata, badges |
| `label` | 14 | `500` (Medium) | 20 | Form labels, button text |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4 | Tight gaps (icon-to-text, badge padding) |
| `sm` | 8 | Small gaps (between related items) |
| `md` | 16 | Standard padding (cards, screen margins) |
| `lg` | 24 | Section spacing |
| `xl` | 32 | Large section breaks |
| `xxl` | 48 | Empty state vertical padding |

### Shadow/Elevation Presets

| Token | iOS | Android | Usage |
|-------|-----|---------|-------|
| `sm` | shadow(0, 1, 2, 0.1) | elevation: 2 | Subtle lift (filter pills) |
| `md` | shadow(0, 2, 4, 0.15) | elevation: 4 | Cards, surfaces |
| `lg` | shadow(0, 4, 8, 0.2) | elevation: 8 | FABs, elevated elements |
| `xl` | shadow(0, 8, 16, 0.25) | elevation: 16 | Modals, bottom sheets |

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4 | Small elements (badges) |
| `md` | 8 | Inputs, buttons |
| `lg` | 12 | Cards |
| `xl` | 16 | Modals, sheets |
| `pill` | 20 | Filter pills, status badges |
| `full` | 9999 | FABs, circular icons |

## Component Interfaces

### EmptyState

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `string` (Ionicons name) | Yes | Icon displayed above message |
| `title` | `string` | Yes | Primary message (PT-BR) |
| `description` | `string` | No | Secondary guidance text |
| `actionLabel` | `string` | No | CTA button label |
| `onAction` | `() => void` | No | CTA button handler |

### FAB (Floating Action Button)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `string` (Ionicons name) | Yes | Icon (default: `"add"`) |
| `onPress` | `() => void` | Yes | Press handler |
| `label` | `string` | No | Optional text label |

### SkeletonLoader

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `width` | `number \| string` | No | Width (default: `"100%"`) |
| `height` | `number` | Yes | Height of skeleton block |
| `borderRadius` | `number` | No | Corner radius (default: `theme.borderRadius.md`) |
| `count` | `number` | No | Number of skeleton rows (default: 1) |

### ErrorRetry

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | No | Error description (default: generic PT-BR message) |
| `onRetry` | `() => void` | Yes | Retry handler |

## Navigation Structure

### Tab Configuration

| Tab | Label (PT-BR) | Icon (active) | Icon (inactive) | Root Screen |
|-----|---------------|---------------|-----------------|-------------|
| 1 | Aulas | `book` | `book-outline` | `(tabs)/index.tsx` |
| 2 | Séries | `library` | `library-outline` | `(tabs)/series.tsx` |
| 3 | Professores | `people` | `people-outline` | `(tabs)/professors.tsx` |
| 4 | Sincronizar | `cloud-upload` | `cloud-upload-outline` | `(tabs)/sync.tsx` |

### Stack Routes (pushed on top of tabs)

| Route | Screen | Pushed From |
|-------|--------|-------------|
| `/lesson/new` | Create lesson | Aulas tab |
| `/lesson/[id]` | Lesson detail | Aulas tab |
| `/series/new` | Create series | Séries tab |
| `/series/[id]` | Series detail | Séries tab |
| `/topics/new` | Create topic | Séries tab (via series detail) |
| `/topics/[id]` | Topic detail | Séries tab (via series detail) |
| `/professors/new` | Create professor | Professores tab |
| `/professors/[id]` | Edit professor | Professores tab |
| `/settings` | Theme toggle | Any tab (via header button) |

## Theme Preference Persistence

| Key | Storage | Values | Default |
|-----|---------|--------|---------|
| `@eb-insights/theme-preference` | AsyncStorage | `"light"` \| `"dark"` \| `"system"` | `"system"` |

**State transitions**:
- App launch → read AsyncStorage → if `"system"`, use `useColorScheme()` result; if `"light"`/`"dark"`, use that directly
- User changes toggle → write to AsyncStorage → update context → re-render tree
- Device theme changes (while preference is `"system"`) → `useColorScheme()` updates → context re-renders
