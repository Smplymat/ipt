import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, IonSplitPane } from '@ionic/angular';
import { MenuComponent } from './components/menu/menu.component';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonSplitPane, IonRouterOutlet, MenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}