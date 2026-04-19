import type { Meta, StoryObj } from '@storybook/react';
import LandingPage from './LandingPage';

const meta: Meta<typeof LandingPage> = {
  title: 'Pages/Landing Page',
  component: LandingPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The main landing page for Narrative Agent with URL, GitHub, and Guest mode options.'
      }
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default View',
};

export const URLMode: Story = {
  name: 'URL Input Mode',
  play: async ({ canvasElement }) => {
    // Auto-select URL tab
    await new Promise(resolve => setTimeout(resolve, 500));
    const urlTab = canvasElement.querySelector('.tab-btn');
    if (urlTab instanceof HTMLElement) {
      urlTab.click();
    }
  }
};

export const GitHubMode: Story = {
  name: 'GitHub Mode',
  play: async ({ canvasElement }) => {
    // Auto-select GitHub tab
    await new Promise(resolve => setTimeout(resolve, 500));
    const githubTab = canvasElement.querySelectorAll('.tab-btn')[1];
    if (githubTab instanceof HTMLElement) {
      githubTab.click();
    }
  }
};

export const GuestMode: Story = {
  name: 'Guest/Demo Mode',
  play: async ({ canvasElement }) => {
    // Auto-select Guest tab
    await new Promise(resolve => setTimeout(resolve, 500));
    const guestTab = canvasElement.querySelectorAll('.tab-btn')[2];
    if (guestTab instanceof HTMLElement) {
      guestTab.click();
    }
  }
};

export const WithLoading: Story = {
  name: 'Loading State',
  play: async ({ canvasElement }) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const loadingOverlay = canvasElement.querySelector('#loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('show');
      // Auto-hide after 3 seconds
      setTimeout(() => {
        loadingOverlay.classList.remove('show');
      }, 3000);
    }
  }
};

export const WithError: Story = {
  name: 'Error State',
  play: async ({ canvasElement }) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const errorEl = canvasElement.querySelector('#url-error');
    if (errorEl instanceof HTMLElement) {
      errorEl.textContent = 'Please enter a valid URL (e.g., https://example.com)';
      errorEl.classList.add('show');
    }
  }
};