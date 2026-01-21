import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tones',
    loadComponent: () => import('./tones/tones.page').then((m) => m.TonesPage),
  },
  {
    path: 'tone-table',
    loadComponent: () => import('./tone-table/tone-table.page').then((m) => m.ToneTablePage),
  },
  {
    path: 'theme-selector',
    loadComponent: () => import('./theme-selector/theme-selector.page').then((m) => m.ThemeSelectorPage),
  },
  {
    path: '',
    redirectTo: 'tones',
    pathMatch: 'full',
  },
  {
    path: 'user-agreement',
    loadComponent: () => import('./legal/user-agreement/user-agreement.page').then( m => m.UserAgreementPage)
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./legal/privacy-policy/privacy-policy.page').then( m => m.PrivacyPolicyPage)
  },
  {
    path: 'pitch-curve-compare',
    loadComponent: () => import('./pitch-curve-compare/pitch-curve-compare.page').then(m => m.PitchCurveComparePage)
  },
];
