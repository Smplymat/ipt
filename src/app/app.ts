import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, IonSplitPane } from '@ionic/angular';
import { MenuComponent } from './components/menu/menu.component';
import { SplashScreenComponent } from './components/splash-screen/splash-screen.component';
import { FloatingCartComponent } from './components/floating-cart/floating-cart.component';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonSplitPane, IonRouterOutlet, MenuComponent, SplashScreenComponent, FloatingCartComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}