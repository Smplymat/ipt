import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Step {
  label: string;
  description?: string;
  icon?: string;
  completed?: boolean;
  active?: boolean;
  error?: boolean;
}

@Component({
  selector: 'ktk-step-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="step-indicator" [class.vertical]="vertical" role="navigation" aria-label="Step indicator">
      <ol class="steps">
        @for (step of steps; track step.label; let i = $index) {
          <li class="step" [class.completed]="step.completed" [class.active]="step.active" [class.error]="step.error">
            <!-- Connector line (except last) -->
            @if (i < steps.length - 1) {
              <div class="step-connector" [class.completed]="step.completed"></div>
            }

            <div class="step-content">
              <!-- Circle indicator -->
              <div class="step-circle" [attr.aria-current]="step.active ? 'step' : null">
                @if (step.completed && !step.error) {
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                } @else if (step.error) {
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                } @else {
                  <span class="step-number">{{ i + 1 }}</span>
                }
              </div>

              <!-- Labels -->
              <div class="step-labels">
                <span class="step-label">{{ step.label }}</span>
                @if (step.description) {
                  <span class="step-description">{{ step.description }}</span>
                }
              </div>

              @if (step.icon) {
                <span class="step-icon" aria-hidden="true">{{ step.icon }}</span>
              }
            </div>
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    .step-indicator {
      --connector-color: var(--ktk-muted-beige);
      --active-color: var(--ktk-accent);
      --completed-color: var(--ktk-primary);
      --error-color: var(--ktk-error);
      --text-color: var(--ktk-text);
      --text-secondary: var(--ktk-text-secondary);
    }

    .steps {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
      min-width: 0;
    }

    .step:not(:last-child) {
      padding-bottom: 0;
    }

    .step-connector {
      position: absolute;
      top: 12px;
      height: 2px;
      background: var(--connector-color);
      z-index: 0;
      transition: background-color var(--ktk-dur-normal) var(--ktk-ease-out);
    }

    .step-indicator:not(.vertical) .step-connector {
      left: 50%;
      right: -50%;
    }

    .step-indicator.vertical .step-connector {
      left: 12px;
      top: 28px;
      bottom: -28px;
      width: 2px;
      height: auto;
    }

    .step-connector.completed {
      background: var(--completed-color);
    }

    .step-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ktk-space-2);
      position: relative;
      z-index: 1;
      text-align: center;
      width: 100%;
    }

    .step-indicator.vertical .step-content {
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
    }

    .step-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--connector-color);
      background: var(--ktk-card-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      font-weight: var(--ktk-fw-bold);
      transition: all var(--ktk-dur-normal) var(--ktk-ease-out);
      flex-shrink: 0;
    }

    .step.completed .step-circle {
      border-color: var(--completed-color);
      background: var(--completed-color);
      color: var(--ktk-primary-contrast);
    }

    .step.active:not(.completed) .step-circle {
      border-color: var(--active-color);
      background: var(--ktk-card-bg);
      color: var(--active-color);
      box-shadow: 0 0 0 4px var(--ktk-accent-focus);
    }

    .step.error .step-circle {
      border-color: var(--error-color);
      background: var(--error-color);
      color: white;
    }

    .step-indicator.vertical .step-circle {
      margin-right: var(--ktk-space-3);
    }

    .step-labels {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .step-label {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      font-weight: var(--ktk-fw-semibold);
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .step.active .step-label {
      font-weight: var(--ktk-fw-bold);
      color: var(--active-color);
    }

    .step.completed .step-label {
      color: var(--completed-color);
    }

    .step.error .step-label {
      color: var(--error-color);
    }

    .step-description {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-xs);
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .step-icon {
      font-size: 1.25rem;
      opacity: 0.6;
    }

    .step-number {
      line-height: 1;
    }

    /* Responsive */
    @media (max-width: 575.98px) {
      .step-indicator:not(.vertical) .step-label {
        font-size: var(--ktk-fs-xs);
      }

      .step-indicator:not(.vertical) .step-description {
        display: none;
      }

      .step-circle {
        width: 24px;
        height: 24px;
        font-size: var(--ktk-fs-xs);
      }
    }
  `]
})
export class StepIndicatorComponent {
  @Input() steps: Step[] = [];
  @Input() vertical = false;
  @Input() currentStep = 0;

  // Auto-compute completed/active from currentStep if not explicitly set
  protected processedSteps = computed(() => {
    return this.steps.map((step, i) => ({
      ...step,
      completed: step.completed ?? (i < this.currentStep),
      active: step.active ?? (i === this.currentStep),
    }));
  });
}