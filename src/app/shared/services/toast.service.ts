import { Injectable, inject, signal, computed } from '@angular/core';
import { ToastController, ToastOptions } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface ToastData {
  message: string;
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
  color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'dark' | 'light';
  buttons?: ToastOptions['buttons'];
  icon?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastCtrl = inject(ToastController);
  private toasts = signal<ToastData[]>([]);

  readonly queue = computed(() => this.toasts());

  private async triggerHaptic(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
    try {
      await Haptics.impact({ style });
    } catch {
      // Haptics not available on web - silently ignore
    }
  }

  async show(options: ToastData): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: options.message,
      duration: options.duration ?? 3000,
      position: options.position ?? 'bottom',
      color: options.color ?? 'dark',
      buttons: options.buttons,
      icon: options.icon,
      cssClass: 'ktk-toast',
      swipeGesture: 'vertical',
    });

    await toast.present();

    // Haptic feedback based on color
    if (options.color === 'danger' || options.color === 'warning') {
      await this.triggerHaptic(ImpactStyle.Heavy);
    } else if (options.color === 'success') {
      await this.triggerHaptic(ImpactStyle.Medium);
    } else {
      await this.triggerHaptic(ImpactStyle.Light);
    }
  }

  async success(message: string, options?: Partial<ToastData>): Promise<void> {
    await this.show({ ...options, message, color: 'success', icon: 'checkmark-circle-outline' });
  }

  async error(message: string, options?: Partial<ToastData>): Promise<void> {
    await this.show({ ...options, message, color: 'danger', icon: 'alert-circle-outline', duration: 4000 });
  }

  async warning(message: string, options?: Partial<ToastData>): Promise<void> {
    await this.show({ ...options, message, color: 'warning', icon: 'alert-outline' });
  }

  async info(message: string, options?: Partial<ToastData>): Promise<void> {
    await this.show({ ...options, message, color: 'primary', icon: 'information-circle-outline' });
  }

  async dismissAll(): Promise<void> {
    await this.toastCtrl.dismiss();
  }
}