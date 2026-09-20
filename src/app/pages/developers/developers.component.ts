import { Component } from '@angular/core';
import {
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonMenuButton,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Developer {
  name: string;
  role: string;
  avatar: string;
  bio: string;
  skills: string[];
  resumeUrl?: string;
}

const DEVELOPERS: Developer[] = [
  { name: 'Ralph Mathew T. Reposar', role: 'Lead Developer', avatar: '/profile.png', bio: 'Architect of the Knead to Know UI. Passionate about pixel-perfect interfaces and smooth Ionic animations.', skills: ['React', 'Ionic', 'TypeScript', 'SCSS'], resumeUrl: 'https://fascinating-fairy-a32e79.netlify.app/' },
  { name: 'Ma. Rosa Camilla S. Sevilla', role: 'UX / UI Developer', avatar: '/sevilla.jpg', bio: 'Crafted the bakery design system from scratch — every colour, curve, and card you see is her handiwork.', skills: ['Figma', 'Design Systems', 'Prototyping', 'Accessibility'], resumeUrl: 'https://blub515.github.io/sevilla-resume/tabs/tab1' },
  { name: 'Albert Blake N. Javier', role: 'QA Developer', avatar: '/javier.png', bio: "Makes sure every page, form, and button works flawlessly before it reaches a customer's screen.", skills: ['Cypress', 'Jest', 'Manual Testing', 'CI/CD'], resumeUrl: 'https://precious-starburst-34a7ed.netlify.app/' },
  { name: 'Ariane Joy P. Rosario', role: 'UI / UX Developer', avatar: '/rosario.png', bio: 'Brings user-centered design thinking to every screen, ensuring the experience feels intuitive and delightful.', skills: ['Figma', 'React', 'SCSS', 'UX Research'], resumeUrl: 'https://timely-khapse-90506d.netlify.app/' },
  { name: 'Nico Recto Aquilar', role: 'Backend Developer', avatar: '/aguilar.png', bio: 'Powers the order management, inventory, and real-time delivery tracking behind the scenes.', skills: ['Node.js', 'PostgreSQL', 'REST APIs', 'Docker'], resumeUrl: 'https://re-su.netlify.app/folder/Inbox' },
];

const STACK = [
  { label: 'Angular', color: '#DD0031', bg: 'rgba(221,0,49,0.12)' },
  { label: 'Ionic', color: '#4854E0', bg: 'rgba(72,84,224,0.12)' },
  { label: 'TypeScript', color: '#3178C6', bg: 'rgba(49,120,198,0.12)' },
  { label: 'SCSS', color: '#CF649A', bg: 'rgba(207,100,154,0.12)' },
  { label: 'Node.js', color: '#43853D', bg: 'rgba(67,133,61,0.12)' },
];

@Component({
  selector: 'app-developers',
  imports: [
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonMenuButton,
    IonRow,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './developers.component.html',
})
export class DevelopersComponent {
  readonly developers = DEVELOPERS;
  readonly stack = STACK;
}