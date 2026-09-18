import { Injectable } from '@angular/core';
import { DEFAULT_MAP_CENTER, GOOGLE_MAPS_API_KEY } from '../config/maps.config';

type GoogleWindow = Window & { google?: any };

interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Thin wrapper around the Google Maps JavaScript API (Maps + Places).
 * Loads the SDK script once, then exposes small helpers for the address
 * autocomplete and the draggable delivery pin.
 *
 * When no API key is configured the app stays fully functional — checkout
 * simply falls back to manual lat/lng entry.
 */
@Injectable({ providedIn: 'root' })
export class MapsService {
  private loadPromise: Promise<void> | null = null;

  /** True once a real Google Maps API key has been added in maps.config.ts. */
  get configured(): boolean {
    return !!GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.startsWith('YOUR_');
  }

  defaultCenter(): GeoPoint {
    return DEFAULT_MAP_CENTER;
  }

  load(): Promise<void> {
    if (!this.configured) {
      return Promise.reject(new Error('Google Maps API key is not configured.'));
    }
    const win = window as GoogleWindow;
    if (win.google?.maps) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const callback = 'kneadToKnowMapsReady';
      const script = document.createElement('script');
      script.async = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}` +
        `&libraries=places,geometry&loading=async&callback=${callback}`;
      script.onerror = () => reject(new Error('Google Maps failed to load.'));
      const target = window as unknown as GoogleWindow & Record<string, unknown>;
      target[callback] = () => resolve();
      document.head.appendChild(script);
    });
    return this.loadPromise;
  }

  /**
   * Binds Places Autocomplete to a raw <input>. `onPlace` fires with the
   * chosen coordinates and formatted address.
   */
  async createAutocomplete(
    input: HTMLInputElement,
    onPlace: (point: GeoPoint, formattedAddress: string) => void
  ): Promise<any> {
    await this.load();
    const google = (window as GoogleWindow).google;
    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ['geometry', 'formatted_address'],
      types: ['address'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (location) {
        onPlace({ lat: location.lat(), lng: location.lng() }, place.formatted_address ?? '');
      }
    });
    return autocomplete;
  }

  /** Creates an interactive map with a draggable pin; tap or drag to move it. */
  async createMap(
    container: HTMLElement,
    center: GeoPoint,
    onPick: (point: GeoPoint) => void
  ): Promise<{ map: any; marker: any }> {
    await this.load();
    const google = (window as GoogleWindow).google;
    const map = new google.maps.Map(container, {
      center,
      zoom: 15,
      mapTypeControl: false,
      fullscreenControl: true,
    });
    const marker = new google.maps.Marker({
      position: center,
      map,
      draggable: true,
      animation: google.maps.Animation.DROP,
    });

    marker.addListener('dragend', (e: { latLng: { lat: () => number; lng: () => number } }) => {
      onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    map.addListener('click', (e: { latLng: { lat: () => number; lng: () => number } }) => {
      marker.setPosition(e.latLng);
      onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });

    return { map, marker };
  }
}