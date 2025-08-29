# Base UI Components

A comprehensive set of reusable UI components built for DesQTA using Svelte 5 runes mode.

## Components

### Button
A versatile button component with multiple variants and sizes.

```svelte
<Button variant="primary" size="md" onclick={() => console.log('clicked')}>
  Click me
</Button>

<Button variant="danger" size="lg" icon={TrashIcon} iconPosition="left">
  Delete
</Button>

<Button loading={true} disabled={false}>
  Loading...
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `disabled`, `loading`, `fullWidth`, `icon`, `iconPosition`

### Card
A flexible container component with header/footer slots.

```svelte
<Card variant="elevated" padding="lg" interactive={true}>
  {#snippet header()}
    <h3>Card Title</h3>
  {/snippet}
  
  <p>Card content goes here</p>
  
  {#snippet footer()}
    <Button>Action</Button>
  {/snippet}
</Card>
```

### Input
A comprehensive input component with validation and icons.

```svelte
<Input 
  bind:value={email}
  type="email"
  label="Email Address"
  placeholder="Enter your email"
  leftIcon={EnvelopeIcon}
  error={emailError}
  required={true}
/>
```

### Badge
Display status, categories, or counts.

```svelte
<Badge variant="success" size="md">
  Active
</Badge>

<Badge variant="primary" dot={true}>
  New
</Badge>

<Badge removable={true} onremove={() => {}}>
  Removable
</Badge>
```

### AsyncWrapper
Handle loading, error, and empty states for data components.

```svelte
<AsyncWrapper 
  loading={isLoading}
  error={error}
  data={items}
  empty={items.length === 0}
  emptyTitle="No items found"
  onretry={() => refetch()}
>
  {#snippet children(data)}
    {#each data as item}
      <div>{item.name}</div>
    {/each}
  {/snippet}
</AsyncWrapper>
```

### DataTable
A feature-rich table component with sorting, selection, and custom cells.

```svelte
<DataTable
  columns={[
    { key: 'name', title: 'Name', sortable: true },
    { key: 'email', title: 'Email' },
    { 
      key: 'actions', 
      title: 'Actions',
      cell: (value, row) => `<Button size="sm">Edit</Button>`
    }
  ]}
  data={users}
  loading={isLoading}
  error={error}
  selectable={true}
  onSort={(column) => handleSort(column)}
  onRowSelect={(row, selected) => handleSelect(row, selected)}
/>
```

### Tabs
Create tabbed interfaces with different variants.

```svelte
<Tabs
  tabs={[
    { id: 'tab1', label: 'Overview', icon: HomeIcon },
    { id: 'tab2', label: 'Settings', icon: CogIcon },
    { id: 'tab3', label: 'Help', disabled: true }
  ]}
  bind:activeTab
  variant="pills"
  fullWidth={true}
>
  {#snippet children(activeTab)}
    {#if activeTab === 'tab1'}
      <div>Overview content</div>
    {:else if activeTab === 'tab2'}
      <div>Settings content</div>
    {/if}
  {/snippet}
</Tabs>
```

### Dropdown
Create dropdown menus with customizable items.

```svelte
<Dropdown
  items={[
    { id: 'edit', label: 'Edit', icon: PencilIcon, onClick: () => edit() },
    { id: 'sep1', separator: true },
    { id: 'delete', label: 'Delete', icon: TrashIcon, danger: true, onClick: () => delete() }
  ]}
  buttonText="Actions"
  showChevron={true}
/>
```

### SearchInput
A specialized input for search functionality with debouncing.

```svelte
<SearchInput
  bind:value={searchQuery}
  placeholder="Search items..."
  debounceMs={300}
  clearable={true}
  onSearch={(query) => handleSearch(query)}
  onClear={() => clearSearch()}
/>
```

### Tooltip
Display helpful information on hover/focus.

```svelte
<Tooltip content="This is a helpful tooltip" placement="top">
  <Button>Hover me</Button>
</Tooltip>
```

### Progress
Show progress with different variants and animations.

```svelte
<Progress 
  value={75} 
  max={100}
  variant="success"
  size="md"
  showLabel={true}
  label="Processing..."
  animated={true}
  striped={true}
/>
```

## Usage

Import components from the UI module:

```typescript
import { Button, Card, Input, AsyncWrapper } from '$lib/components/ui';
```

All components follow consistent design patterns:
- Support for dark mode
- Accessible by default
- Type-safe with TypeScript
- Consistent sizing and spacing
- Smooth transitions and animations
- Focus management and keyboard navigation

## Design System

### Colors
Components use CSS custom properties for theming:
- `--accent-*` for primary colors
- `--slate-*` for neutral colors
- Semantic colors: `red`, `green`, `yellow`, `blue` for states

### Sizing
Consistent size scale across components:
- `xs`, `sm`, `md`, `lg`, `xl`

### Transitions
All interactive elements use:
- `transition-all duration-200`
- Hover effects with `hover:scale-105`
- Focus rings for accessibility

## Best Practices

1. **Composition over Configuration**: Use slots and snippets for flexibility
2. **Consistent Props**: Similar props across components (size, variant, disabled, etc.)
3. **Error Handling**: Always provide error states and fallbacks
4. **Loading States**: Use AsyncWrapper for data-dependent components
5. **Accessibility**: All components include proper ARIA attributes
6. **Type Safety**: Use TypeScript interfaces for all props
