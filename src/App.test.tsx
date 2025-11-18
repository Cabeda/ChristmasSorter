import React from 'react';
import { it, expect } from 'vitest';
import App from './App';

it('renders without crashing', () => {
  // Render without a DOM by calling the component function
  const tree = App();
  expect(tree).toBeDefined();
});
