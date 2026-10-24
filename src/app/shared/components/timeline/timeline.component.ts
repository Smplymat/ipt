import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';

export interface TimelineEvent {
  id: string;
  label: string;
  time: string;
  description?: string;
  icon?: string;
  status: 'completed' | 'current' | 'pending' | 'failed';
  color?: string;
}

@Component({
  selector: 'ktk-timeline',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="timeline" role="list" aria-label="Order timeline">
      @for (event of events; track event.id; let i = $index; let last = $last) {
        <div class="timeline-item" [class]="'status-' + event.status" role="listitem">
          <!-- Connector line -->
          <div class="timeline-connector">
            <div class="timeline-dot" [style.background]="event.color || dotColor(event.status)"></div>
            @if (!last) {
              <div class="timeline-line" [class.completed]="event.status === 'completed' || event.status === 'current'"></div>
            }
          </div>

          <!-- Content -->
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-label">{{ event.label }}</span>
              <time class="timeline-time" [dateTime]="event.time">{{ formatTime(event.time) }}</time>
            </div>
            @if (event.description) {
              <p class="timeline-description">{{ event.description }}</p>
            }
            @if (event.icon) {
              <div class="timeline-icon" aria-hidden="true">
                <ion-icon [name]="event.icon"></ion-icon>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
      position: relative;
    }

    .timeline-item {
      display: flex;
      gap: var(--ktk-space-3);
      padding: var(--ktk-space-3) 0;
      position: relative;
    }

    .timeline-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      width: 24px;
      position: relative;
    }

    .timeline-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid var(--ktk-card-bg);
      box-shadow: 0 0 0 2px currentColor;
      z-index: 1;
      transition: all var(--ktk-dur-normal) var(--ktk-ease-out);
    }

    .timeline-line {
      flex: 1;
      width: 2px;
      background: var(--ktk-muted-beige);
      transition: background-color var(--ktk-dur-normal) var(--ktk-ease-out);
    }

    .timeline-line.completed {
      background: var(--ktk-accent);
    }

    .timeline-content {
      flex: 1;
      min-width: 0;
      padding-top: 2px;
    }

    .timeline-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ktk-space-2);
      margin-bottom: var(--ktk-space-1);
      flex-wrap: wrap;
    }

    .timeline-label {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-base);
      font-weight: var(--ktk-fw-semibold);
      color: var(--ktk-text);
    }

    .timeline-time {
      font-family: var(--ktk-font-serif);
      font-size: var(--ktk-fs-sm);
      color: var(--ktk-text-secondary);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .timeline-description {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-fs-sm);
      color: var(--ktk-text-secondary);
      margin: 0;
      line-height: 1.5;
    }

    .timeline-icon {
      margin-top: var(--ktk-space-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--ktk-radius-small);
      background: var(--ktk-muted-beige);
      color: var(--ktk-text-muted);

      ion-icon {
        font-size: 1.125rem;
      }
    }

    /* Status variants */
    .timeline-item.status-completed .timeline-label {
      color: var(--ktk-primary);
    }

    .timeline-item.status-completed .timeline-time {
      color: var(--ktk-text-muted);
    }

    .timeline-item.status-current .timeline-dot {
      box-shadow: 0 0 0 4px var(--ktk-accent-focus);
      animation: ktk-pulse 2s ease-in-out infinite;
    }

    .timeline-item.status-current .timeline-label {
      color: var(--ktk-accent);
      font-weight: var(--ktk-fw-bold);
    }

    .timeline-item.status-failed .timeline-dot {
      background: var(--ktk-error);
    }

    .timeline-item.status-failed .timeline-label {
      color: var(--ktk-error);
    }

    .timeline-item.status-pending .timeline-dot {
      background: var(--ktk-muted-beige);
    }

    .timeline-item.status-pending .timeline-label {
      color: var(--ktk-text-muted);
    }

    @keyframes ktk-pulse {
      0%, 100% { box-shadow: 0 0 0 4px var(--ktk-accent-focus); }
      50% { box-shadow: 0 0 0 8px rgba(242, 169, 0, 0.2); }
    }

    /* Responsive */
    @media (max-width: 575.98px) {
      .timeline-item {
        gap: var(--ktk-space-2);
        padding: var(--ktk-space-2) 0;
      }

      .timeline-connector {
        width: 20px;
      }

      .timeline-dot {
        width: 16px;
        height: 16px;
      }
    }
  `]
})
export class TimelineComponent {
  @Input() events: TimelineEvent[] = [];

  dotColor(status: TimelineEvent['status']): string {
    switch (status) {
      case 'completed': return 'var(--ktk-primary)';
      case 'current': return 'var(--ktk-accent)';
      case 'failed': return 'var(--ktk-error)';
      case 'pending': return 'var(--ktk-muted-beige)';
    }
  }

  formatTime(timeString: string): string {
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return timeString;
      return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return timeString;
    }
  }
}