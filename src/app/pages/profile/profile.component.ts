import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonMenuButton,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { trashOutline } from 'ionicons/icons';
import { Address, AddressesService, NewAddress } from '../../services/addresses.service';
import { AuthService } from '../../services/auth.service';
import { toErrorMessage } from '../../services/orders.service';

type ProfileTab = 'profile' | 'addresses' | 'password';

@Component({
  selector: 'app-profile',
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly addressesService = inject(AddressesService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly user = this.auth.user;
  readonly tab = signal<ProfileTab>('profile');

  // ── Edit profile ───────────────────────────────────────────────────────────
  readonly displayName = signal('');
  readonly savingProfile = signal(false);
  readonly profileMessage = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);

  // ── Addresses ──────────────────────────────────────────────────────────────
  readonly addresses = signal<Address[]>([]);
  readonly addressesLoading = signal(false);
  readonly addressesError = signal<string | null>(null);

  readonly addrLabel = signal('Home');
  readonly addrRecipient = signal('');
  readonly addrPhone = signal('');
  readonly addrLine = signal('');
  readonly addrCity = signal('');
  readonly addrDefault = signal(false);
  readonly savingAddress = signal(false);
  readonly addressFormError = signal<string | null>(null);

  // ── Change password ────────────────────────────────────────────────────────
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly savingPassword = signal(false);
  readonly passwordMessage = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  readonly passwordErrors = computed(() => {
    const errs: Partial<Record<'newPassword' | 'confirm', string>> = {};
    if (this.newPassword().length < 6) errs.newPassword = 'Password must be at least 6 characters.';
    if (this.confirmPassword() !== this.newPassword()) errs.confirm = 'Passwords do not match.';
    return errs;
  });

  readonly passwordInvalid = computed(() => Object.keys(this.passwordErrors()).length > 0);

  constructor() {
    this.displayName.set(this.auth.user()?.displayName ?? '');
    void this.loadAddresses();
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async saveProfile(): Promise<void> {
    this.savingProfile.set(true);
    this.profileMessage.set(null);
    this.profileError.set(null);
    try {
      await this.auth.updateDisplayName(this.displayName());
      this.profileMessage.set('Profile updated.');
    } catch (err) {
      this.profileError.set(toErrorMessage(err));
    } finally {
      this.savingProfile.set(false);
    }
  }

  // ── Addresses ──────────────────────────────────────────────────────────────

  async loadAddresses(): Promise<void> {
    this.addressesLoading.set(true);
    this.addressesError.set(null);
    try {
      this.addresses.set(await this.addressesService.list());
    } catch (err) {
      this.addressesError.set(toErrorMessage(err));
    } finally {
      this.addressesLoading.set(false);
    }
  }

  async saveAddress(): Promise<void> {
    if (this.savingAddress()) return;
    if (this.addrRecipient().trim().length < 2) {
      return this.addressFormError.set('Please enter the recipient name.');
    }
    if (!/^(?:63|0)?9\d{9}$/.test(this.addrPhone().replace(/\D/g, ''))) {
      return this.addressFormError.set('Enter a valid mobile number (e.g. 09171234567).');
    }
    if (this.addrLine().trim().length < 5) {
      return this.addressFormError.set('Please enter the full street address.');
    }

    this.savingAddress.set(true);
    this.addressFormError.set(null);
    try {
      const input: NewAddress = {
        label: this.addrLabel().trim() || 'Home',
        recipient: this.addrRecipient().trim(),
        phone: this.addrPhone().trim(),
        address_line: this.addrLine().trim(),
        city: this.addrCity().trim(),
        is_default: this.addrDefault(),
      };
      await this.addressesService.create(input);
      this.addrRecipient.set('');
      this.addrPhone.set('');
      this.addrLine.set('');
      this.addrCity.set('');
      this.addrDefault.set(false);
      await this.loadAddresses();
      const toast = await this.toast.create({ message: 'Address saved.', duration: 1600, position: 'bottom' });
      await toast.present();
    } catch (err) {
      this.addressFormError.set(toErrorMessage(err));
    } finally {
      this.savingAddress.set(false);
    }
  }

  async makeDefault(a: Address): Promise<void> {
    try {
      await this.addressesService.makeDefault(a.id);
      await this.loadAddresses();
    } catch (err) {
      this.addressesError.set(toErrorMessage(err));
    }
  }

  async removeAddress(a: Address): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Remove address',
      message: `Remove "${a.label} — ${a.address_line}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            try {
              await this.addressesService.remove(a.id);
              this.addresses.update((list) => list.filter((x) => x.id !== a.id));
            } catch (err) {
              this.addressesError.set(toErrorMessage(err));
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // ── Password ───────────────────────────────────────────────────────────────

  async changePassword(): Promise<void> {
    if (Object.keys(this.passwordErrors()).length > 0 || this.savingPassword()) return;
    this.savingPassword.set(true);
    this.passwordMessage.set(null);
    this.passwordError.set(null);
    try {
      await this.auth.changePassword(this.newPassword());
      this.passwordMessage.set('Password changed. Use the new password next time you sign in.');
      this.newPassword.set('');
      this.confirmPassword.set('');
    } catch (err) {
      this.passwordError.set(toErrorMessage(err));
    } finally {
      this.savingPassword.set(false);
    }
  }

  readonly trashIcon = trashOutline;
}