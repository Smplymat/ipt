import { Component, Input, Output, EventEmitter, forwardRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { IonIcon, IonTextarea, IonSelect, IonSelectOption } from '@ionic/angular';

export type FieldType = 'text' | 'email' | 'tel' | 'password' | 'number' | 'textarea' | 'select' | 'datetime-local';
export type FieldSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ktk-form-field',
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, IonTextarea, IonSelect, IonSelectOption],
  template: `
    <div class="form-field" [class.has-error]="error" [class.disabled]="disabled">
      @if (label) {
        <label class="field-label" [for]="id">
          {{ label }}
          @if (required) {
            <span class="required" aria-hidden="true">*</span>
          }
        </label>
      }

      <div class="field-input-wrapper" [class.with-icon]="icon">
        @if (icon) {
          <ion-icon [name]="icon" class="field-icon" aria-hidden="true"></ion-icon>
        }

        @if (type === 'textarea') {
          <ion-textarea
            [id]="id"
            [placeholder]="placeholder"
            [disabled]="disabled"
            [readonly]="readonly"
            [rows]="rows"
            [value]="value"
            (ionInput)="onInput($event)"
            (ionBlur)="onBlur()"
            class="field-input field-textarea"
            [attr.aria-invalid]="error ? 'true' : 'false'"
            [attr.aria-describedby]="error ? errorId() : (helper ? helperId() : null)">
          </ion-textarea>
        } @else if (type === 'select') {
          <ion-select
            [id]="id"
            [disabled]="disabled"
            [value]="value"
            (ionChange)="onSelectChange($event)"
            class="field-input field-select"
            [attr.aria-invalid]="error ? 'true' : 'false'"
            [attr.aria-describedby]="error ? errorId() : (helper ? helperId() : null)">
            @for (opt of options; track opt.value) {
              <ion-select-option [value]="opt.value">{{ opt.label }}</ion-select-option>
            }
          </ion-select>
        } @else {
          <input
            [id]="id"
            [type]="type"
            [placeholder]="placeholder"
            [disabled]="disabled"
            [readonly]="readonly"
            [value]="value"
            (input)="onInput($event)"
            (blur)="onBlur()"
            class="field-input"
            [attr.aria-invalid]="error ? 'true' : 'false'"
            [attr.aria-describedby]="error ? errorId() : (helper ? helperId() : null)"
            [attr.min]="min"
            [attr.max]="max"
            [attr.step]="step"
            [attr.autocomplete]="autocomplete"
            [attr.inputmode]="inputmode">
        }
      </div>

      @if (error) {
        <p id="{{ errorId() }}" class="field-error" role="alert">{{ error }}</p>
      } @else if (hint) {
        <p id="{{ helperId() }}" class="field-hint">{{ hint }}</p>
      } @else if (helper) {
        <p id="{{ helperId() }}" class="field-helper">{{ helper }}</p>
      }
    </div>
  `,
  styles: [`
    .form-field {
      display: flex;
      flex-direction: column;
      gap: var(--ktk-space-1);
      width: 100%;
    }

    .field-label {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-label-font-size);
      font-weight: var(--ktk-label-font-weight);
      color: var(--ktk-text);
      text-transform: uppercase;
      letter-spacing: 0.3px;

      .required {
        color: var(--ktk-error);
        margin-left: 2px;
      }
    }

    .field-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;

      .field-icon {
        position: absolute;
        left: var(--ktk-space-3);
        font-size: 1.125rem;
        color: var(--ktk-text-muted);
        pointer-events: none;
        z-index: 1;
      }

      &.with-icon .field-input,
      &.with-icon .field-textarea,
      &.with-icon .field-select {
        padding-left: 44px;
      }
    }

    .field-input,
    .field-textarea,
    .field-select {
      width: 100%;
      box-sizing: border-box;
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-field-font-size);
      color: var(--ktk-text);
      background: var(--ktk-input-bg);
      border: var(--ktk-border-width-bold) solid var(--ktk-text);
      border-radius: var(--ktk-radius-input);
      padding: var(--ktk-field-padding-y) var(--ktk-field-padding-x);
      min-height: var(--ktk-field-height);
      outline: none;
      transition: border-color var(--ktk-dur-fast) var(--ktk-ease-out), box-shadow var(--ktk-dur-fast) var(--ktk-ease-out);

      &::placeholder {
        color: var(--ktk-text-muted);
      }

      &:focus {
        border-color: var(--ktk-accent);
        box-shadow: var(--ktk-focus-ring);
      }

      &:disabled,
      &:read-only {
        background: var(--ktk-muted-beige);
        color: var(--ktk-text-secondary);
        cursor: not-allowed;
      }

      &.field-textarea {
        min-height: 100px;
        resize: vertical;
        padding-top: var(--ktk-field-padding-y);
        padding-bottom: var(--ktk-field-padding-y);
        font-family: var(--ktk-font-sans);
      }

      &.field-select {
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%232A1A10' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right var(--ktk-space-3) center;
        padding-right: 40px;
      }
    }

    .field-helper {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-helper-font-size);
      color: var(--ktk-text-muted);
      margin: 0;
    }

    .field-error {
      font-family: var(--ktk-font-sans);
      font-size: var(--ktk-error-font-size);
      font-weight: var(--ktk-fw-semibold);
      color: var(--ktk-error);
      margin: 0;
      display: flex;
      align-items: center;
      gap: var(--ktk-space-1);

      &::before {
        content: '!';
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--ktk-error);
        color: white;
        font-size: 0.625rem;
        font-weight: var(--ktk-fw-bold);
      }
    }

    /* Error state border */
    .has-error .field-input,
    .has-error .field-textarea,
    .has-error .field-select {
      border-color: var(--ktk-error);
    }

    .has-error .field-input:focus,
    .has-error .field-textarea:focus,
    .has-error .field-select:focus {
      box-shadow: 0 0 0 2px var(--ktk-error-bg), 0 0 0 4px var(--ktk-error);
    }

    /* Size variants */
    .field-input.field-sm,
    .field-textarea.field-sm,
    .field-select.field-sm {
      min-height: 36px;
      font-size: var(--ktk-fs-sm);
      padding: var(--ktk-space-2) var(--ktk-space-3);
    }

    .field-input.field-lg,
    .field-textarea.field-lg,
    .field-select.field-lg {
      min-height: 52px;
      font-size: var(--ktk-fs-lg);
      padding: var(--ktk-space-4) var(--ktk-space-4);
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FormFieldComponent),
      multi: true
    }
  ]
})
export class FormFieldComponent implements ControlValueAccessor {
  @Input() id = '';
  @Input() label = '';
  @Input() type: FieldType = 'text';
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() error = '';
  @Input() helper = '';
  @Input() hint = '';
  @Input() icon = '';
  @Input() options: { value: any; label: string }[] = [];
  @Input() rows = 4;
  @Input() min: string | number = '';
  @Input() max: string | number = '';
  @Input() step: string | number = '';
  @Input() autocomplete = 'off';
  @Input() inputmode = '';
  @Input() size: FieldSize = 'md';
  @Input() value: any = '';
  @Output() valueChange = new EventEmitter<any>();

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  errorId = computed(() => `${this.id}-error`);
  helperId = computed(() => `${this.id}-helper`);

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.value = target.value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

  onSelectChange(event: CustomEvent): void {
    this.value = event.detail.value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: any): void {
    this.value = value ?? '';
    this.valueChange.emit(this.value);
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}