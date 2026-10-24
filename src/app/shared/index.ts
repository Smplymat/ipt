// ═══════════════════════════════════════════════════════════════════════════
// Shared Components Barrel Export
// Import from '@shared' instead of individual paths
// ═══════════════════════════════════════════════════════════════════════════

// UI Components
export { PageHeaderComponent } from './components/page-header/page-header.component';
export { ButtonComponent } from './components/button/button.component';
export { ChipComponent } from './components/chip/chip.component';
export { StatusTagComponent } from './components/status-tag/status-tag.component';
export { FormFieldComponent } from './components/form-field/form-field.component';
export { SegmentedTabsComponent } from './components/segmented-tabs/segmented-tabs.component';
export { ProductCardComponent } from './components/product-card/product-card.component';
export { CategoryTileComponent } from './components/category-tile/category-tile.component';
export { TicketCardComponent } from './components/ticket-card/ticket-card.component';
export { BottomSheetComponent } from './components/bottom-sheet/bottom-sheet.component';
export { TabBarComponent } from './components/tab-bar/tab-bar.component';
export { FloatingCartBarComponent } from './components/floating-cart-bar/floating-cart-bar.component';
export { EmptyStateComponent } from './components/empty-state/empty-state.component';
export { ErrorStateComponent } from './components/error-state/error-state.component';
export { SkeletonComponent } from './components/skeleton-loader/skeleton-loader.component';
export { StepIndicatorComponent } from './components/step-indicator/step-indicator.component';
export { TimelineComponent } from './components/timeline/timeline.component';

// Services
export { ToastService } from './services/toast.service';

// Icons
export { registerAllIcons, IonIcon } from './icon-registry';

// Types
export type { ButtonVariant, ButtonSize } from './components/button/button.component';
export type { ChipVariant, ChipSize } from './components/chip/chip.component';
export type { StatusType } from './components/status-tag/status-tag.component';
export type { FieldType, FieldSize } from './components/form-field/form-field.component';
export type { TabSegment } from './components/segmented-tabs/segmented-tabs.component';
export type { Product } from '../services/products.service';
export type { TicketAction } from './components/ticket-card/ticket-card.component';
export type { Step } from './components/step-indicator/step-indicator.component';
export type { TimelineEvent } from './components/timeline/timeline.component';
export type { EmptyStateIllustration } from './components/empty-state/empty-state.component';
export type { ErrorType } from './components/error-state/error-state.component';
export type { SkeletonType } from './components/skeleton-loader/skeleton-loader.component';
export type { ToastData } from './services/toast.service';