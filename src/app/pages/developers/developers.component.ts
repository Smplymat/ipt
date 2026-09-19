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
  emoji: string;
  bio: string;
  skills: string[];
  resumeUrl?: string;
}

const DEVELOPERS: Developer[] = [
  { name: 'Ralph Mathew T. Reposar', role: 'Lead Developer', avatar: '/profile.png', emoji: '⚡', bio: 'Architect of the Knead to Know UI. Passionate about pixel-perfect interfaces and smooth Ionic animations.', skills: ['React', 'Ionic', 'TypeScript', 'SCSS'], resumeUrl: 'https://fascinating-fairy-a32e79.netlify.app/' },
  { name: 'Ma. Rosa Camilla S. Sevilla', role: 'UX / UI Developer', avatar: '/sevilla.jpg', emoji: '🎨', bio: 'Crafted the bakery design system from scratch — every colour, curve, and card you see is her handiwork.', skills: ['Figma', 'Design Systems', 'Prototyping', 'Accessibility'] },
  { name: 'Albert Blake N. Javier', role: 'QA Developer', avatar: '/javier.png', emoji: '🔍', bio: "Makes sure every page, form, and button works flawlessly before it reaches a customer's screen.", skills: ['Cypress', 'Jest', 'Manual Testing', 'CI/CD'], resumeUrl: 'https://fantastic-longma-224325.netlify.app/resume' },
  { name: 'Ariane Joy P. Rosario', role: 'UI / UX Developer', avatar: '/rosario.png', emoji: '🌸', bio: 'Brings user-centered design thinking to every screen, ensuring the experience feels intuitive and delightful.', skills: ['Figma', 'React', 'SCSS', 'UX Research'], resumeUrl: 'https://timely-khapse-90506d.netlify.app/resume?fbclid=IwY2xjawUSRphwZG9mBWV4dG4DYWVtAjEwAGJyaWQRMVpxUUpRWmc5UUE4dHlrTkZzcnRjBmFwcF9pZBAyMjIwMzkxNzg4MjAwODkyAAEe8svnI7ZQ9dx_aATvCRsb2MaCUqV1qp_DlZ4cv4U4CmWmIjrc4-JpaH84UuE_aem_TTY54CtNusTFN_0UIoHPfQ' },
  { name: 'Nico Recto Aquilar', role: 'Backend Developer', avatar: '/aguilar.png', emoji: '🛠️', bio: 'Powers the order management, inventory, and real-time delivery tracking behind the scenes.', skills: ['Node.js', 'PostgreSQL', 'REST APIs', 'Docker'], resumeUrl: 'https://re-su.netlify.app/folder/Inbox' },
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