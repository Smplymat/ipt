import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [RouterLink, IonButton, IonContent, IonHeader, IonInput, IonTitle, IonToolbar],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);

  readonly displayName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly needEmailConfirmation = signal(false);

  constructor() {
    // Already signed in? Send the user to the dashboard for their role.
    effect(() => {
      if (this.auth.ready() && this.auth.user() !== null) {
        void this.auth.redirectAfterAuth();
      }
    });
  }

  async handleSubmit(): Promise<void> {
    this.errorMessage.set(null);

    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.errorMessage.set('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters long.');
      return;
    }
    if (password !== this.confirmPassword()) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.signUp(email, password, this.displayName());
    this.submitting.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.message ?? 'Could not create your account. Please try again.');
      return;
    }

    if (result.needEmailConfirmation) {
      this.needEmailConfirmation.set(true);
      return;
    }

    await this.auth.redirectAfterAuth();
  }
}